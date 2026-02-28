# Unsloth Two-Pass Forensic Classifier: Colab Handoff

## Overview
This document contains exactly what you need to fine-tune your custom forensic classifier in Google Colab Pro using Unsloth. Because your training dataset is already highly structured and maps directly to MCL 722.23 factors, you can train a highly accurate Small Language Model (SLM) in under 20 minutes to handle "Pass 1" ingestion.

## The Strategy
1. **The Training Data:** I have already extracted your 191 legacy behavioral patterns and formatted them perfectly for Unsloth. The data is located at: `data/training_datasets/behavioral_patterns/unsloth_dataset.jsonl`.
2. **The Goal:** Train a model to take a raw text chunk and return a strict JSON object with `{ "category": "gaslighting", "severity": 8 }`.
3. **The Result:** A `.gguf` file you will load into Ollama locally to classify incoming text at blazing speed without API costs.

## Recommended Base Models (for Colab Pro fine-tuning)

You have a few great options depending on your exact need:

### 1. `unsloth/Meta-Llama-3.1-8B-Instruct` (The Gold Standard)
- **Why:** Llama 3.1 8B is the undisputed king of local SLMs. It follows JSON formatting instructions flawlessly.
- **Speed:** Very fast to train (under 15 mins on Colab Pro A100/L4).
- **Inference:** Runs easily on any modern CPU/GPU via Ollama.
- **Recommendation:** **START HERE.** This is the safest, most reliable bet for strict JSON output.

### 2. `unsloth/Qwen2.5-7B-Instruct` (The Overachiever)
- **Why:** Qwen 2.5 punches way above its weight class for reasoning and nuance. If your behavioral patterns are very subtle, Qwen might pick up on the context better than Llama.
- **Speed:** Identical to Llama.
- **Recommendation:** Use this if Llama 3.1 struggles to catch the nuance of "Parental Alienation" versus "General Insults".

### 3. `unsloth/gemma-2-9b-it` (The Google Option)
- **Why:** Google's Gemma 2 models are incredibly good at structured extraction tasks. 
- **Note:** Sometimes slightly harder to run in Ollama compared to Llama/Qwen.

### 4. `unsloth/Nemotron-Mini-4B-Instruct` (The Lightweight Sniper)
- **Why:** Nvidia's Nemotron-Mini is a 4B parameter model that punches *far* above its weight. It is specifically optimized for retrieval, roleplay, and function calling (JSON extraction). 
- **Speed:** Because it is only 4B parameters, it will train in half the time of Llama 3 and run incredibly fast locally on just a CPU or small GPU.
- **Recommendation:** If you want absolute maximum speed during Pass 1 ingestion without sacrificing reasoning, this is the best option.

---

## The Colab Instructions (Copy & Paste these steps)

1. Open the [Unsloth Llama 3.1 Notebook](https://colab.research.google.com/github/unslothai/unsloth/blob/main/notebooks/Llama_3_1_8b_Instruct.ipynb).
2. Run the first few cells to install Unsloth and load the model. (When it asks for the model name, leave it as `unsloth/Meta-Llama-3.1-8B-Instruct`).
3. **Upload your dataset:** Drag and drop your `unsloth_dataset.jsonl` into the Colab file explorer on the left.
4. **Modify the Formatting Cell:** Find the cell that defines the `alpaca_prompt`. Change it to look exactly like this:

```python
alpaca_prompt = """Below is an instruction that describes a task, paired with an input that provides further context. Write a response that appropriately completes the request.

### Instruction:
{}

### Input:
{}

### Response:
{}"""

EOS_TOKEN = tokenizer.eos_token # Must add EOS_TOKEN
def formatting_prompts_func(examples):
    instructions = examples["instruction"]
    inputs       = examples["input"]
    outputs      = examples["output"]
    texts = []
    for instruction, input, output in zip(instructions, inputs, outputs):
        # Must add EOS_TOKEN, otherwise your generation will go on forever!
        text = alpaca_prompt.format(instruction, input, output) + EOS_TOKEN
        texts.append(text)
    return { "text" : texts, }

from datasets import load_dataset
dataset = load_dataset("json", data_files="unsloth_dataset.jsonl", split="train")
dataset = dataset.map(formatting_prompts_func, batched = True,)
```

5. **Train the Model:** Run the training cell. It should take about 10-15 minutes.
6. **Save to GGUF:** Scroll down to the very bottom of the notebook to the "GGUF / llama.cpp Conversion" section. 
7. Run the cell that says: `model.save_pretrained_gguf("model", tokenizer, quantization_method = "q4_k_m")`. 
8. Download the resulting `unsloth.Q4_K_M.gguf` file to your PC.

## Integration Back into the Platform
Once you have the `.gguf` file, you will place it in your project folder, create an `Ollama` Modelfile:
```dockerfile
FROM ./unsloth.Q4_K_M.gguf
SYSTEM "You are a forensic behavioral analyst. You only output strict JSON."
```
And we will plug it directly into the `BehavioralFlagExtractor` we just built!