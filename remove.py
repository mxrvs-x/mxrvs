import re

input_file = r"E:\Downloads\cnf-fcen-csv\YIELD AMOUNT.csv"
output_file = r"E:\Downloads\cnf-fcen-csv\YIELD AMOUNToutput.csv"

def remove_trailing_commas(line):
    return line.rstrip(",\r\n") + "\n"

with open(input_file, "r", encoding="cp1252") as infile, \
     open(output_file, "w", encoding="utf-8") as outfile:

    for line in infile:
        outfile.write(remove_trailing_commas(line))

print("Done!")

print("Trailing commas removed successfully!")