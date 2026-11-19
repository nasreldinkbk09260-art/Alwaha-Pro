package __ALWAHA_PACKAGE__;

import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.KeyFactory;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.MessageDigest;
import java.security.PublicKey;
import java.security.SecureRandom;
import java.security.interfaces.ECPublicKey;
import java.security.spec.ECGenParameterSpec;
import java.security.spec.X509EncodedKeySpec;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import javax.crypto.Cipher;
import javax.crypto.KeyAgreement;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

/**
 * Ephemeral in-memory session primitives for Alwaha's future Wi-Fi Direct transport.
 * This class does not open sockets, pair devices, or advertise transport readiness.
 */
public final class AlwahaLocalSessionCrypto implements AutoCloseable {
    public static final String PROTOCOL = "ALWAHA-P2P/1";
    private static final int SESSION_NONCE_BYTES = 32;
    private static final int MAX_PUBLIC_KEY_BYTES = 512;
    private static final int GCM_NONCE_BYTES = 12;
    private static final int GCM_TAG_BYTES = 16;
    private static final int MAX_TEXT_BYTES = 16 * 1024;
    private static final int MAX_FILE_META_BYTES = 4 * 1024;
    private static final int MAX_FILE_CHUNK_BYTES = 32 * 1024;
    private static final int MAX_CONTROL_BYTES = 1024;
    private static final Set<String> FRAME_TYPES = new HashSet<>(Arrays.asList(
        "text", "file-meta", "file-chunk", "file-accept", "file-reject", "ack", "close"
    ));

    private final SecureRandom random;
    private KeyPair keyPair;
    private byte[] localNonce;
    private boolean established;
    private boolean localAccepted;
    private boolean peerAccepted;
    private boolean localIsLow;
    private byte[] transcript;
    private byte[] sendKey;
    private byte[] receiveKey;
    private byte[] sendNoncePrefix;
    private byte[] receiveNoncePrefix;
    private byte[] confirmationKey;
    private long sendSequence;
    private long receiveSequence;

    public AlwahaLocalSessionCrypto() throws GeneralSecurityException {
        random = new SecureRandom();
        KeyPairGenerator generator = KeyPairGenerator.getInstance("EC");
        generator.initialize(new ECGenParameterSpec("secp256r1"), random);
        keyPair = generator.generateKeyPair();
        localNonce = new byte[SESSION_NONCE_BYTES];
        random.nextBytes(localNonce);
    }

    public synchronized byte[] publicKeyEncoded() {
        ensureOpen();
        return keyPair.getPublic().getEncoded().clone();
    }

    public synchronized byte[] nonce() {
        ensureOpen();
        return localNonce.clone();
    }

    public synchronized void establish(byte[] remotePublicKeyEncoded, byte[] remoteNonce)
        throws GeneralSecurityException, IOException {
        ensureOpen();
        if (established) throw new IllegalStateException("Session keys are already established.");
        if (remotePublicKeyEncoded == null || remotePublicKeyEncoded.length < 64 || remotePublicKeyEncoded.length > MAX_PUBLIC_KEY_BYTES) {
            throw new GeneralSecurityException("Invalid peer public key size.");
        }
        if (remoteNonce == null || remoteNonce.length != SESSION_NONCE_BYTES || MessageDigest.isEqual(localNonce, remoteNonce)) {
            throw new GeneralSecurityException("Invalid or repeated peer nonce.");
        }

        byte[] sharedSecret = null;
        byte[] keyMaterial = null;
        byte[] salt = null;
        try {
            PublicKey remotePublicKey = KeyFactory.getInstance("EC")
                .generatePublic(new X509EncodedKeySpec(remotePublicKeyEncoded));
            if (!(remotePublicKey instanceof ECPublicKey)) throw new GeneralSecurityException("Peer key is not an EC public key.");

            KeyAgreement agreement = KeyAgreement.getInstance("ECDH");
            agreement.init(keyPair.getPrivate());
            agreement.doPhase(remotePublicKey, true);
            sharedSecret = agreement.generateSecret();

            byte[] localPublicKey = keyPair.getPublic().getEncoded();
            int order = compareUnsigned(localPublicKey, remotePublicKeyEncoded);
            if (order == 0) throw new GeneralSecurityException("Peer reused the local ephemeral public key.");
            localIsLow = order < 0;

            byte[] lowPublicKey = localIsLow ? localPublicKey : remotePublicKeyEncoded;
            byte[] highPublicKey = localIsLow ? remotePublicKeyEncoded : localPublicKey;
            byte[] lowNonce = localIsLow ? localNonce : remoteNonce;
            byte[] highNonce = localIsLow ? remoteNonce : localNonce;
            byte[] candidateTranscript = buildTranscript(lowPublicKey, lowNonce, highPublicKey, highNonce);
            salt = MessageDigest.getInstance("SHA-256").digest(candidateTranscript);
            byte[] info = concat(utf8(PROTOCOL), utf8("|session-keys|"), candidateTranscript);
            keyMaterial = hkdfSha256(sharedSecret, salt, info, 104);

            byte[] lowToHighKey = Arrays.copyOfRange(keyMaterial, 0, 32);
            byte[] highToLowKey = Arrays.copyOfRange(keyMaterial, 32, 64);
            byte[] lowToHighNoncePrefix = Arrays.copyOfRange(keyMaterial, 64, 68);
            byte[] highToLowNoncePrefix = Arrays.copyOfRange(keyMaterial, 68, 72);
            byte[] candidateConfirmationKey = Arrays.copyOfRange(keyMaterial, 72, 104);

            transcript = candidateTranscript;
            sendKey = localIsLow ? lowToHighKey : highToLowKey;
            receiveKey = localIsLow ? highToLowKey : lowToHighKey;
            sendNoncePrefix = localIsLow ? lowToHighNoncePrefix : highToLowNoncePrefix;
            receiveNoncePrefix = localIsLow ? highToLowNoncePrefix : lowToHighNoncePrefix;
            confirmationKey = candidateConfirmationKey;
            sendSequence = 0;
            receiveSequence = 0;
            established = true;
        } finally {
            wipe(sharedSecret);
            wipe(keyMaterial);
            wipe(salt);
        }
    }

    public synchronized String comparisonCode() throws GeneralSecurityException {
        ensureEstablished();
        byte[] digest = hmacSha256(confirmationKey, concat(utf8("compare|"), transcript));
        long value = ByteBuffer.wrap(digest).getInt() & 0xffffffffL;
        wipe(digest);
        return String.format(Locale.US, "%06d", value % 1_000_000L);
    }

    /** Generate only after the local user compares the code and explicitly accepts. */
    public synchronized byte[] acceptanceToken() throws GeneralSecurityException {
        ensureEstablished();
        String role = localIsLow ? "LOW" : "HIGH";
        byte[] token = hmacSha256(confirmationKey, concat(utf8("accept:" + role + "|"), transcript));
        localAccepted = true;
        return token;
    }

    /** Verify the other participant's role-bound explicit acceptance. */
    public synchronized boolean verifyPeerAcceptance(byte[] peerToken) throws GeneralSecurityException {
        ensureEstablished();
        if (peerToken == null || peerToken.length != 32) return false;
        String peerRole = localIsLow ? "HIGH" : "LOW";
        byte[] expected = hmacSha256(confirmationKey, concat(utf8("accept:" + peerRole + "|"), transcript));
        boolean valid = MessageDigest.isEqual(expected, peerToken);
        wipe(expected);
        if (valid) peerAccepted = true;
        return valid;
    }

    public synchronized Frame encrypt(String type, String transferId, byte[] plaintext)
        throws GeneralSecurityException {
        ensurePaired();
        validateTypeAndTransfer(type, transferId);
        validatePayloadSize(type, plaintext == null ? -1 : plaintext.length);
        if (sendSequence == Long.MAX_VALUE) throw new GeneralSecurityException("Session send sequence exhausted.");
        long sequence = sendSequence + 1;
        byte[] nonce = frameNonce(sendNoncePrefix, sequence);
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(sendKey, "AES"), new GCMParameterSpec(128, nonce));
        cipher.updateAAD(frameAad(type, transferId, sequence));
        byte[] ciphertext = cipher.doFinal(plaintext);
        sendSequence = sequence;
        return new Frame(type, transferId, sequence, nonce, ciphertext);
    }

    public synchronized byte[] decrypt(Frame frame) throws GeneralSecurityException {
        ensurePaired();
        if (frame == null) throw new GeneralSecurityException("Missing encrypted frame.");
        validateTypeAndTransfer(frame.type, frame.transferId);
        if (frame.sequence <= 0 || receiveSequence == Long.MAX_VALUE || frame.sequence != receiveSequence + 1) {
            throw new GeneralSecurityException("Repeated, stale, or out-of-order frame sequence.");
        }
        if (frame.nonce.length != GCM_NONCE_BYTES || frame.ciphertext.length < GCM_TAG_BYTES) {
            throw new GeneralSecurityException("Malformed encrypted frame.");
        }
        validatePayloadSize(frame.type, frame.ciphertext.length - GCM_TAG_BYTES);
        byte[] expectedNonce = frameNonce(receiveNoncePrefix, frame.sequence);
        if (!MessageDigest.isEqual(expectedNonce, frame.nonce)) {
            wipe(expectedNonce);
            throw new GeneralSecurityException("Encrypted frame nonce does not match its sequence.");
        }
        wipe(expectedNonce);

        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(receiveKey, "AES"), new GCMParameterSpec(128, frame.nonce));
        cipher.updateAAD(frameAad(frame.type, frame.transferId, frame.sequence));
        byte[] plaintext = cipher.doFinal(frame.ciphertext);
        receiveSequence = frame.sequence;
        return plaintext;
    }

    @Override
    public synchronized void close() {
        wipe(sendKey);
        wipe(receiveKey);
        wipe(sendNoncePrefix);
        wipe(receiveNoncePrefix);
        wipe(confirmationKey);
        wipe(transcript);
        wipe(localNonce);
        sendKey = receiveKey = sendNoncePrefix = receiveNoncePrefix = confirmationKey = transcript = localNonce = null;
        keyPair = null;
        established = false;
        localAccepted = peerAccepted = false;
        sendSequence = receiveSequence = 0;
    }

    private void ensureOpen() {
        if (keyPair == null || localNonce == null) throw new IllegalStateException("Session has been closed.");
    }

    private void ensureEstablished() {
        ensureOpen();
        if (!established) throw new IllegalStateException("Peer pairing and key agreement are not complete.");
    }

    private void ensurePaired() {
        ensureEstablished();
        if (!localAccepted || !peerAccepted) throw new IllegalStateException("Both participants must explicitly accept the verified pairing code.");
    }

    private static void validateTypeAndTransfer(String type, String transferId) throws GeneralSecurityException {
        if (type == null || !FRAME_TYPES.contains(type)) throw new GeneralSecurityException("Unknown frame type.");
        String id = transferId == null ? "" : transferId;
        if (id.length() > 128 || !id.matches("[A-Za-z0-9._:-]*")) throw new GeneralSecurityException("Invalid transfer identifier.");
        boolean requiresTransfer = type.startsWith("file-");
        if (requiresTransfer && id.isEmpty()) throw new GeneralSecurityException("File frames require a transfer identifier.");
        if (("text".equals(type) || "close".equals(type)) && !id.isEmpty()) throw new GeneralSecurityException("This frame type cannot carry a transfer identifier.");
    }

    private static void validatePayloadSize(String type, int size) throws GeneralSecurityException {
        if (size < 0) throw new GeneralSecurityException("Missing frame payload.");
        int max;
        switch (type) {
            case "text": max = MAX_TEXT_BYTES; break;
            case "file-meta": max = MAX_FILE_META_BYTES; break;
            case "file-chunk": max = MAX_FILE_CHUNK_BYTES; break;
            default: max = MAX_CONTROL_BYTES; break;
        }
        if (size > max) throw new GeneralSecurityException("Frame payload exceeds the protocol limit.");
    }

    private static byte[] frameNonce(byte[] prefix, long sequence) {
        return ByteBuffer.allocate(GCM_NONCE_BYTES).put(prefix).putLong(sequence).array();
    }

    private static byte[] frameAad(String type, String transferId, long sequence) {
        byte[] protocol = utf8(PROTOCOL);
        byte[] frameType = utf8(type);
        byte[] id = utf8(transferId == null ? "" : transferId);
        return ByteBuffer.allocate(4 + protocol.length + 4 + frameType.length + 8 + 4 + id.length)
            .putInt(protocol.length).put(protocol)
            .putInt(frameType.length).put(frameType)
            .putLong(sequence)
            .putInt(id.length).put(id)
            .array();
    }

    private static byte[] buildTranscript(byte[] lowPublicKey, byte[] lowNonce, byte[] highPublicKey, byte[] highNonce)
        throws IOException {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        DataOutputStream output = new DataOutputStream(bytes);
        writeBytes(output, utf8(PROTOCOL));
        writeBytes(output, lowPublicKey);
        writeBytes(output, lowNonce);
        writeBytes(output, highPublicKey);
        writeBytes(output, highNonce);
        output.flush();
        return bytes.toByteArray();
    }

    private static void writeBytes(DataOutputStream output, byte[] value) throws IOException {
        output.writeInt(value.length);
        output.write(value);
    }

    private static int compareUnsigned(byte[] left, byte[] right) {
        int length = Math.min(left.length, right.length);
        for (int i = 0; i < length; i++) {
            int a = left[i] & 0xff;
            int b = right[i] & 0xff;
            if (a != b) return Integer.compare(a, b);
        }
        return Integer.compare(left.length, right.length);
    }

    private static byte[] hkdfSha256(byte[] inputKeyMaterial, byte[] salt, byte[] info, int length)
        throws GeneralSecurityException {
        byte[] pseudoRandomKey = hmacSha256(salt, inputKeyMaterial);
        byte[] output = new byte[length];
        byte[] previous = new byte[0];
        int offset = 0;
        int counter = 1;
        try {
            while (offset < length) {
                Mac mac = Mac.getInstance("HmacSHA256");
                mac.init(new SecretKeySpec(pseudoRandomKey, "HmacSHA256"));
                mac.update(previous);
                mac.update(info);
                mac.update((byte) counter++);
                byte[] block = mac.doFinal();
                int copy = Math.min(block.length, length - offset);
                System.arraycopy(block, 0, output, offset, copy);
                offset += copy;
                wipe(previous);
                previous = block;
            }
            return output;
        } catch (GeneralSecurityException error) {
            wipe(output);
            throw error;
        } finally {
            wipe(previous);
            wipe(pseudoRandomKey);
        }
    }

    private static byte[] hmacSha256(byte[] key, byte[] data) throws GeneralSecurityException {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(key, "HmacSHA256"));
        return mac.doFinal(data);
    }

    private static byte[] concat(byte[]... values) {
        int size = 0;
        for (byte[] value : values) size += value.length;
        byte[] result = new byte[size];
        int offset = 0;
        for (byte[] value : values) {
            System.arraycopy(value, 0, result, offset, value.length);
            offset += value.length;
        }
        return result;
    }

    private static byte[] utf8(String value) {
        return value.getBytes(StandardCharsets.UTF_8);
    }

    private static void wipe(byte[] value) {
        if (value != null) Arrays.fill(value, (byte) 0);
    }

    public static final class Frame {
        public final String type;
        public final String transferId;
        public final long sequence;
        private final byte[] nonce;
        private final byte[] ciphertext;

        public Frame(String type, String transferId, long sequence, byte[] nonce, byte[] ciphertext) {
            if (nonce == null || nonce.length != GCM_NONCE_BYTES) throw new IllegalArgumentException("Invalid encrypted frame nonce size.");
            if (ciphertext == null || ciphertext.length < GCM_TAG_BYTES || ciphertext.length > MAX_FILE_CHUNK_BYTES + GCM_TAG_BYTES) {
                throw new IllegalArgumentException("Invalid or oversized encrypted frame payload.");
            }
            this.type = type;
            this.transferId = transferId == null ? "" : transferId;
            this.sequence = sequence;
            this.nonce = nonce.clone();
            this.ciphertext = ciphertext.clone();
        }

        public byte[] nonce() { return nonce.clone(); }
        public byte[] ciphertext() { return ciphertext.clone(); }
    }
}
