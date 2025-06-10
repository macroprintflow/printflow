
"use client";
import {useState} from "react";
import { getFunctions, httpsCallable } from "firebase/functions"; // Changed import
import { app } from "@/lib/firebase/clientApp"; // Import app instance

import {Button} from "@/components/ui/button";
import {Textarea} from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";

// Initialize Firebase Functions
const funcs = getFunctions(app); // Initialize functions service

export default function DevAssistantDialog() {
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAsk = async () => {
    if (!prompt) return;
    setLoading(true);
    try {
      const generateCode = httpsCallable(funcs, "generateCode"); // Use initialized funcs
      const result = await generateCode({prompt});
      // @ts-ignore
      setResponse(result.data.result);
    } catch (err: any) {
      console.error("GPT call failed:", err.message);
      setResponse("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">💡 Dev Assistant</Button>
      </DialogTrigger>
      <DialogContent className="w-[90vw] max-w-2xl">
        <h2 className="font-bold text-xl mb-2">ChatGPT Assistant</h2>
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ask GPT to generate code, logic, or UI..."
          rows={4}
        />
        <Button onClick={handleAsk} disabled={loading} className="mt-2">
          {loading ? "Thinking..." : "Generate"}
        </Button>
        <Textarea
          className="mt-4"
          readOnly
          value={response}
          rows={10}
          placeholder="Response will appear here..."
        />
      </DialogContent>
    </Dialog>
  );
}
