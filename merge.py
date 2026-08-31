import os

def merge_files(file1, file2, output_file):
    if not (os.path.exists(file1) and os.path.exists(file2)):
        print(f"تخطي {output_file}: أحد الملفات غير موجود.")
        return

    with open(file1, 'r', encoding='utf-8') as f1, open(file2, 'r', encoding='utf-8') as f2:
        content1 = f1.read()
        content2 = f2.read()

    lines1 = content1.splitlines()
    lines2 = content2.splitlines()
    
    merged_lines = list(lines1)
    for line in lines2:
        if line.strip() and line not in content1:
            merged_lines.append(line)

    with open(output_file, 'w', encoding='utf-8') as out:
        out.write('\n'.join(merged_lines))
    print(f"تم الدمج بنجاح في {output_file}")

merge_files('index_1.html', 'index_2.html', 'index.html')
merge_files('app_1.js', 'app_2.js', 'app.js')
