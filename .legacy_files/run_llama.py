import subprocess

prompt = "Explain how feedback improves learning."

result = subprocess.run(
    ["ollama", "run", "llama2", "--temperature", "0.7", "--max-tokens", "1000"],
    input=prompt.encode(),
    capture_output=True
)

print(result.stdout.decode())
