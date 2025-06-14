import pandas as pd

# Load the CSV file
df = pd.read_csv(r"C:\Users\18022\Downloads\generated_records.csv")

# Convert the DataFrame to a pipe-delimited format
text_file_content = df.to_csv(sep='|', index=False, header=False)

# Write to a text file
with open('output_file.txt', 'w') as f:
    f.write(text_file_content)
