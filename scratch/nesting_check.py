
import sys

def analyze_nesting(filepath):
    with open(filepath, 'r') as f:
        lines = f.readlines()
    
    braces = 0
    parens = 0
    tags = 0
    
    for i, line in enumerate(lines):
        line_num = i + 1
        braces += line.count('{') - line.count('}')
        parens += line.count('(') - line.count(')')
        # Simple tag count, ignoring self-closing for now
        tags += line.count('<') - line.count('>')
        
        # Look for the return statement zone
        if 125 <= line_num <= 145:
            print(f"Line {line_num}: Braces={braces}, Parens={parens}, Tags={tags} | {line.strip()}")

if __name__ == "__main__":
    analyze_nesting(sys.argv[1])
