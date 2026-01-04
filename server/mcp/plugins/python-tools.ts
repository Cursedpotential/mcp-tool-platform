/**
 * Python Library Tools Plugin
 *
 * Invokes Python libraries via subprocess for advanced parsing/analysis.
 * These calls require the corresponding Python packages to be installed.
 */

import { spawn } from 'child_process';

interface PythonResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

function runPython<T>(script: string, payload: Record<string, unknown>): Promise<PythonResult<T>> {
  return new Promise((resolve) => {
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    const proc = spawn(pythonCmd, ['-c', script], {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 30000,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        try {
          resolve({ success: true, data: JSON.parse(stdout) as T });
          return;
        } catch (error) {
          resolve({ success: false, error: `Failed to parse Python output: ${stdout}` });
          return;
        }
      }
      resolve({ success: false, error: stderr || `Python process exited with code ${code}` });
    });

    proc.on('error', (error) => {
      resolve({ success: false, error: `Python error: ${error.message}` });
    });

    proc.stdin.write(JSON.stringify(payload));
    proc.stdin.end();
  });
}

export async function runSpacy(args: {
  text: string;
  operations?: string[];
  model?: string;
}): Promise<{ tokens?: unknown; entities?: unknown; dependencies?: unknown }> {
  const script = `
import json
import sys
import spacy

payload = json.loads(sys.stdin.read() or "{}")
text = payload.get("text", "")
operations = payload.get("operations") or []
model = payload.get("model") or "en_core_web_sm"

try:
    nlp = spacy.load(model)
except Exception:
    nlp = spacy.blank("en")

doc = nlp(text)
result = {}

if not operations or "tokenize" in operations:
    result["tokens"] = [t.text for t in doc]

if not operations or "ner" in operations:
    result["entities"] = [{"text": e.text, "label": e.label_, "start": e.start_char, "end": e.end_char} for e in doc.ents]

if not operations or "dependency" in operations:
    result["dependencies"] = [{"text": t.text, "dep": t.dep_, "head": t.head.text} for t in doc]

print(json.dumps(result))
`;

  const result = await runPython(script, args);
  if (!result.success) {
    throw new Error(result.error || 'spaCy execution failed');
  }
  return result.data ?? {};
}

export async function runNltk(args: {
  text: string;
  operation: 'tokenize' | 'stem' | 'lemmatize' | 'chunk' | 'wordnet';
}): Promise<{ result: unknown }> {
  const script = `
import json
import sys
import nltk
from nltk.stem import PorterStemmer, WordNetLemmatizer

payload = json.loads(sys.stdin.read() or "{}")
text = payload.get("text", "")
operation = payload.get("operation", "tokenize")

if operation == "tokenize":
    result = nltk.word_tokenize(text)
elif operation == "stem":
    stemmer = PorterStemmer()
    result = [stemmer.stem(t) for t in nltk.word_tokenize(text)]
elif operation == "lemmatize":
    lemmatizer = WordNetLemmatizer()
    result = [lemmatizer.lemmatize(t) for t in nltk.word_tokenize(text)]
else:
    result = []

print(json.dumps({"result": result}))
`;

  const result = await runPython<{ result: unknown }>(script, args);
  if (!result.success) {
    throw new Error(result.error || 'NLTK execution failed');
  }
  return result.data ?? { result: [] };
}

export async function runTransformers(args: {
  text: string;
  operation: 'encode' | 'similarity' | 'classify' | 'qa';
  model?: string;
  options?: Record<string, unknown>;
}): Promise<{ result: unknown }> {
  const script = `
import json
import sys

payload = json.loads(sys.stdin.read() or "{}")
text = payload.get("text", "")
operation = payload.get("operation", "encode")
model = payload.get("model")

try:
    from transformers import pipeline
except Exception as e:
    print(json.dumps({"error": "transformers not installed"}))
    sys.exit(1)

if operation == "classify":
    classifier = pipeline("text-classification", model=model)
    result = classifier(text)
elif operation == "qa":
    qa = pipeline("question-answering", model=model)
    question = payload.get("options", {}).get("question", "")
    context = payload.get("options", {}).get("context", text)
    result = qa(question=question, context=context)
else:
    encoder = pipeline("feature-extraction", model=model)
    result = encoder(text)

print(json.dumps({"result": result}))
`;

  const result = await runPython<{ result: unknown }>(script, args);
  if (!result.success) {
    throw new Error(result.error || 'Transformers execution failed');
  }
  return result.data ?? { result: null };
}

export async function runBeautifulSoup(args: {
  html: string;
  selector?: string;
  operation: 'find' | 'find_all' | 'select' | 'text' | 'attrs';
}): Promise<{ result: unknown }> {
  const script = `
import json
import sys
from bs4 import BeautifulSoup

payload = json.loads(sys.stdin.read() or "{}")
html = payload.get("html", "")
selector = payload.get("selector")
operation = payload.get("operation", "text")

soup = BeautifulSoup(html, "html.parser")

if operation == "text":
    result = soup.get_text()
elif operation == "attrs":
    node = soup.select_one(selector) if selector else soup
    result = dict(node.attrs) if node else {}
elif operation == "select":
    result = [el.get_text() for el in soup.select(selector or "body")]
elif operation == "find_all":
    result = [el.get_text() for el in soup.find_all(selector or True)]
else:
    el = soup.find(selector) if selector else soup
    result = el.get_text() if el else ""

print(json.dumps({"result": result}))
`;

  const result = await runPython<{ result: unknown }>(script, args);
  if (!result.success) {
    throw new Error(result.error || 'BeautifulSoup execution failed');
  }
  return result.data ?? { result: null };
}

export async function runPdfPlumber(args: {
  path: string;
  pages?: number[];
  extractTables?: boolean;
}): Promise<{ text: string; tables?: unknown[]; pages: number }> {
  const script = `
import json
import sys
import pdfplumber

payload = json.loads(sys.stdin.read() or "{}")
path = payload.get("path")
pages = payload.get("pages")
extract_tables = payload.get("extractTables", False)

text_parts = []
tables = []

with pdfplumber.open(path) as pdf:
    page_indices = pages if pages else list(range(len(pdf.pages)))
    for i in page_indices:
        page = pdf.pages[i]
        text_parts.append(page.extract_text() or "")
        if extract_tables:
            tables.extend(page.extract_tables() or [])

result = {"text": "\\n".join(text_parts), "pages": len(page_indices)}
if extract_tables:
    result["tables"] = tables

print(json.dumps(result))
`;

  const result = await runPython<{ text: string; tables?: unknown[]; pages: number }>(script, args);
  if (!result.success) {
    throw new Error(result.error || 'pdfplumber execution failed');
  }
  return result.data ?? { text: '', pages: 0 };
}

export async function runPandas(args: {
  input: string;
  operation: 'read' | 'filter' | 'groupby' | 'merge' | 'pivot' | 'describe';
  options?: Record<string, unknown>;
}): Promise<{ data: unknown; columns?: string[]; shape?: number[] }> {
  const script = `
import json
import sys
import pandas as pd

payload = json.loads(sys.stdin.read() or "{}")
input_data = payload.get("input", "")
operation = payload.get("operation", "read")
options = payload.get("options") or {}

def load_df(value):
    if isinstance(value, str) and value.strip().startswith("["):
        return pd.DataFrame(json.loads(value))
    if isinstance(value, str) and value.strip().startswith("{"):
        return pd.DataFrame(json.loads(value))
    if isinstance(value, str) and value.endswith(".csv"):
        return pd.read_csv(value)
    if isinstance(value, str) and value.endswith(".xlsx"):
        return pd.read_excel(value)
    return pd.DataFrame(json.loads(value))

df = load_df(input_data)

if operation == "filter":
    query = options.get("query")
    if query:
        df = df.query(query)
elif operation == "groupby":
    by = options.get("by")
    agg = options.get("agg", "size")
    df = df.groupby(by).agg(agg).reset_index()
elif operation == "merge":
    right = load_df(options.get("right"))
    on = options.get("on")
    how = options.get("how", "inner")
    df = df.merge(right, on=on, how=how)
elif operation == "pivot":
    df = df.pivot(index=options.get("index"), columns=options.get("columns"), values=options.get("values"))
elif operation == "describe":
    df = df.describe(include='all')

result = {
    "data": df.reset_index().to_dict(orient="records"),
    "columns": list(df.columns),
    "shape": [int(df.shape[0]), int(df.shape[1])]
}

print(json.dumps(result))
`;

  const result = await runPython<{ data: unknown; columns?: string[]; shape?: number[] }>(script, args);
  if (!result.success) {
    throw new Error(result.error || 'pandas execution failed');
  }
  return result.data ?? { data: [] };
}

export async function runLlamaIndexChunk(args: {
  text: string;
  chunkSize?: number;
  chunkOverlap?: number;
}): Promise<{ chunks: Array<{ text: string; startChar?: number; endChar?: number }> }> {
  const script = `
import json
import sys

payload = json.loads(sys.stdin.read() or "{}")
text = payload.get("text", "")
chunk_size = payload.get("chunkSize", 512)
chunk_overlap = payload.get("chunkOverlap", 50)

chunks = []

try:
    from llama_index.core.node_parser import SentenceSplitter
    splitter = SentenceSplitter(chunk_size=chunk_size, chunk_overlap=chunk_overlap)
    nodes = splitter.get_nodes_from_text(text)
    for node in nodes:
        chunk = {
            "text": getattr(node, "text", "") or getattr(node, "get_content", lambda: "")(),
            "startChar": getattr(node, "start_char_idx", None),
            "endChar": getattr(node, "end_char_idx", None),
        }
        chunks.append(chunk)
except Exception:
    # Fallback to naive chunking if llama_index isn't available.
    start = 0
    length = len(text)
    while start < length:
        end = min(length, start + chunk_size)
        chunks.append({"text": text[start:end], "startChar": start, "endChar": end})
        start = max(end - chunk_overlap, end)

print(json.dumps({"chunks": chunks}))
`;

  const result = await runPython<{ chunks: Array<{ text: string; startChar?: number; endChar?: number }> }>(
    script,
    args as Record<string, unknown>
  );
  if (!result.success) {
    throw new Error(result.error || 'LlamaIndex chunking failed');
  }
  return result.data ?? { chunks: [] };
}

export async function runLangChainPrompt(args: {
  template: string;
  variables?: Record<string, string>;
}): Promise<{ prompt: string }> {
  const script = `
import json
import sys

payload = json.loads(sys.stdin.read() or "{}")
template = payload.get("template", "")
variables = payload.get("variables") or {}

prompt = ""

try:
    from langchain_core.prompts import PromptTemplate
    prompt = PromptTemplate.from_template(template).format(**variables)
except Exception:
    try:
        prompt = template.format(**variables)
    except Exception:
        prompt = template

print(json.dumps({"prompt": prompt}))
`;

  const result = await runPython<{ prompt: string }>(script, args as Record<string, unknown>);
  if (!result.success) {
    throw new Error(result.error || 'LangChain prompt formatting failed');
  }
  return result.data ?? { prompt: '' };
}

export async function runLangChainSplit(args: {
  text: string;
  chunkSize?: number;
  chunkOverlap?: number;
  separator?: string;
}): Promise<{ chunks: string[] }> {
  const script = `
import json
import sys

payload = json.loads(sys.stdin.read() or "{}")
text = payload.get("text", "")
chunk_size = payload.get("chunkSize", 512)
chunk_overlap = payload.get("chunkOverlap", 50)
separator = payload.get("separator", "\\n\\n")

chunks = []

try:
    from langchain_text_splitters import RecursiveCharacterTextSplitter
    splitter = RecursiveCharacterTextSplitter(chunk_size=chunk_size, chunk_overlap=chunk_overlap, separators=[separator, "\\n", " "])
    chunks = splitter.split_text(text)
except Exception:
    start = 0
    length = len(text)
    while start < length:
        end = min(length, start + chunk_size)
        chunks.append(text[start:end])
        start = max(end - chunk_overlap, end)

print(json.dumps({"chunks": chunks}))
`;

  const result = await runPython<{ chunks: string[] }>(script, args as Record<string, unknown>);
  if (!result.success) {
    throw new Error(result.error || 'LangChain split failed');
  }
  return result.data ?? { chunks: [] };
}

export async function runLangGraphFlow(args: {
  states: Array<{ id: string; payload?: Record<string, unknown> }>;
  edges: Array<{ from: string; to: string }>;
  start: string;
  end: string;
}): Promise<{ trace: Array<{ state: string; payload?: Record<string, unknown> }> }> {
  const script = `
import json
import sys

payload = json.loads(sys.stdin.read() or "{}")
states = {state.get("id"): state.get("payload") or {} for state in payload.get("states", [])}
edges = payload.get("edges", [])
start = payload.get("start")
end = payload.get("end")

trace = []

try:
    from langgraph.graph import StateGraph
    class State(dict):
        pass

    graph = StateGraph(State)
    for state_id in states.keys():
        def make_node(node_id):
            def node_fn(state):
                return {**state, **states.get(node_id, {})}
            return node_fn
        graph.add_node(state_id, make_node(state_id))
    for edge in edges:
        graph.add_edge(edge.get("from"), edge.get("to"))
    graph.set_entry_point(start)
    graph.set_finish_point(end)
    app = graph.compile()
    result = app.invoke({})
    trace.append({"state": end, "payload": result})
except Exception:
    current = start
    visited = set()
    while current and current not in visited:
        visited.add(current)
        trace.append({"state": current, "payload": states.get(current)})
        if current == end:
            break
        next_state = None
        for edge in edges:
            if edge.get("from") == current:
                next_state = edge.get("to")
                break
        current = next_state

print(json.dumps({"trace": trace}))
`;

  const result = await runPython<{ trace: Array<{ state: string; payload?: Record<string, unknown> }> }>(
    script,
    args as Record<string, unknown>
  );
  if (!result.success) {
    throw new Error(result.error || 'LangGraph flow failed');
  }
  return result.data ?? { trace: [] };
}
