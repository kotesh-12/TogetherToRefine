# Step 1: Install dependencies (run this in terminal if not already installed)
# pip install torch transformers accelerate sentencepiece

from transformers import AutoModelForCausalLM, AutoTokenizer
import torch

# Step 2: Load the LLaMA 2 model (adjust path if stored locally)
model_name = "meta-llama/Llama-2-7b-chat-hf"  # if you have HF model
# If local: model_name = "./llama-2-7b-chat"

print("Loading model... this may take some time ⏳")

tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModelForCausalLM.from_pretrained(
    model_name,
    torch_dtype=torch.float16,  # uses less memory
    device_map="auto"
)

print("Model loaded ✅")

# Step 3: Chat function
def chat_with_llama(prompt, max_new_tokens=200):
    inputs = tokenizer(prompt, return_tensors="pt").to("cuda")
    outputs = model.generate(
        **inputs,
        max_new_tokens=max_new_tokens,
        do_sample=True,
        temperature=0.7,
        top_p=0.9
    )
    response = tokenizer.decode(outputs[0], skip_special_tokens=True)
    return response

# Step 4: Run chatbot loop
print("\nWelcome to your LLaMA 2 Chatbot! Type 'quit' to exit.\n")
while True:
    user_input = input("You: ")
    if user_input.lower() in ["quit", "exit"]:
        print("Goodbye 👋")
        break
    prompt = f"[INST] {user_input} [/INST]"  # instruction-tuned style
    answer = chat_with_llama(prompt)
    print("Bot:", answer.split("[/INST]")[-1].strip())
