package __ALWAHA_PACKAGE__;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.util.Arrays;

public final class AlwahaLocalSessionCryptoTest {
    @FunctionalInterface
    interface CheckedAction { void run() throws Exception; }

    private static int assertions;

    public static void main(String[] args) throws Exception {
        AlwahaLocalSessionCrypto alice = new AlwahaLocalSessionCrypto();
        AlwahaLocalSessionCrypto bob = new AlwahaLocalSessionCrypto();
        alice.establish(bob.publicKeyEncoded(), bob.nonce());
        bob.establish(alice.publicKeyEncoded(), alice.nonce());

        check(alice.comparisonCode().equals(bob.comparisonCode()), "both peers derive the same comparison code");
        byte[] aliceAccept = alice.acceptanceToken();
        byte[] bobAccept = bob.acceptanceToken();
        check(alice.verifyPeerAcceptance(bobAccept), "Alice verifies Bob's role-bound acceptance");
        check(bob.verifyPeerAcceptance(aliceAccept), "Bob verifies Alice's role-bound acceptance");
        byte[] badAccept = bobAccept.clone();
        badAccept[0] ^= 0x01;
        check(!alice.verifyPeerAcceptance(badAccept), "tampered acceptance token is rejected");

        byte[] message = "رسالة محلية مشفرة".getBytes(StandardCharsets.UTF_8);
        AlwahaLocalSessionCrypto.Frame first = alice.encrypt("text", "", message);
        byte[] changedCiphertext = first.ciphertext();
        changedCiphertext[0] ^= 0x01;
        AlwahaLocalSessionCrypto.Frame tampered = new AlwahaLocalSessionCrypto.Frame(
            first.type, first.transferId, first.sequence, first.nonce(), changedCiphertext
        );
        expectFailure(() -> bob.decrypt(tampered), "AES-GCM rejects modified ciphertext without consuming the sequence");
        check(Arrays.equals(message, bob.decrypt(first)), "valid frame decrypts after a rejected tampered attempt");
        expectFailure(() -> bob.decrypt(first), "replayed frame sequence is rejected");

        AlwahaLocalSessionCrypto.Frame second = alice.encrypt("text", "", "second".getBytes(StandardCharsets.UTF_8));
        AlwahaLocalSessionCrypto.Frame third = alice.encrypt("text", "", "third".getBytes(StandardCharsets.UTF_8));
        expectFailure(() -> bob.decrypt(third), "out-of-order frame is rejected");
        check(new String(bob.decrypt(second), StandardCharsets.UTF_8).equals("second"), "expected next sequence is accepted");
        check(new String(bob.decrypt(third), StandardCharsets.UTF_8).equals("third"), "following sequence is accepted");

        byte[] reply = "رد من الجهاز الثاني".getBytes(StandardCharsets.UTF_8);
        check(Arrays.equals(reply, alice.decrypt(bob.encrypt("text", "", reply))), "reverse direction uses its independent key and nonce prefix");

        byte[] metadata = "{\"name\":\"photo.jpg\",\"size\":5}".getBytes(StandardCharsets.UTF_8);
        AlwahaLocalSessionCrypto.Frame fileMeta = alice.encrypt("file-meta", "file-001", metadata);
        AlwahaLocalSessionCrypto.Frame wrongTransfer = new AlwahaLocalSessionCrypto.Frame(
            fileMeta.type, "file-002", fileMeta.sequence, fileMeta.nonce(), fileMeta.ciphertext()
        );
        expectFailure(() -> bob.decrypt(wrongTransfer), "transfer identifier is authenticated as additional data");
        check(Arrays.equals(metadata, bob.decrypt(fileMeta)), "file metadata decrypts for the authenticated transfer");

        byte[] chunk = new byte[32 * 1024];
        Arrays.fill(chunk, (byte) 7);
        check(Arrays.equals(chunk, bob.decrypt(alice.encrypt("file-chunk", "file-001", chunk))), "bounded file chunk encrypts and decrypts");
        expectFailure(() -> alice.encrypt("text", "", new byte[16 * 1024 + 1]), "oversized text frame is rejected");
        expectFailure(() -> alice.encrypt("file-meta", "../unsafe", metadata), "unsafe transfer identifier is rejected");
        expectFailure(() -> bob.decrypt(new AlwahaLocalSessionCrypto.Frame("unknown", "", 1, new byte[12], new byte[16])), "unknown frame type is rejected");

        AlwahaLocalSessionCrypto samePeer = new AlwahaLocalSessionCrypto();
        byte[] samePublic = samePeer.publicKeyEncoded();
        byte[] sameNonce = samePeer.nonce();
        expectFailure(() -> samePeer.establish(samePublic, sameNonce), "self-pairing with the same ephemeral key and nonce is rejected");
        samePeer.close();

        alice.close();
        expectFailure(() -> alice.encrypt("text", "", message), "closed session cannot encrypt");
        bob.close();
        System.out.println("LOCAL_SESSION_CRYPTO=PASS (" + assertions + " assertions)");
    }

    private static void check(boolean condition, String label) {
        assertions++;
        if (!condition) throw new AssertionError(label);
        System.out.println("PASS: " + label);
    }

    private static void expectFailure(CheckedAction action, String label) throws Exception {
        assertions++;
        try {
            action.run();
        } catch (GeneralSecurityException | IllegalArgumentException | IllegalStateException expected) {
            System.out.println("PASS: " + label);
            return;
        }
        throw new AssertionError(label + " (operation unexpectedly succeeded)");
    }
}
