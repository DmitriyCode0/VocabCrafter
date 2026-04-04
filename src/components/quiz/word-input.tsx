"use client";

import Image from "next/image";
import { useRef, useState, type ChangeEvent, type ClipboardEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, ImagePlus, Sparkles, X } from "lucide-react";
import type { QuizTerm } from "@/types/quiz";
import { type LearningLanguage, type SourceLanguage } from "@/lib/languages";

const MAX_SCREENSHOTS = 3;
const MAX_SCREENSHOT_SIZE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

interface ScreenshotDraft {
  id: string;
  name: string;
  mimeType: (typeof ACCEPTED_IMAGE_TYPES)[number];
  dataUrl: string;
}

function createScreenshotId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isAcceptedImageType(
  value: string,
): value is (typeof ACCEPTED_IMAGE_TYPES)[number] {
  return ACCEPTED_IMAGE_TYPES.includes(
    value as (typeof ACCEPTED_IMAGE_TYPES)[number],
  );
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("Failed to read screenshot"));
    };

    reader.onerror = () => {
      reject(new Error("Failed to read screenshot"));
    };

    reader.readAsDataURL(file);
  });
}

interface WordInputProps {
  onParsed: (terms: QuizTerm[]) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  targetLanguage: LearningLanguage;
  sourceLanguage: SourceLanguage;
}

export function WordInput({
  onParsed,
  isLoading,
  setIsLoading,
  targetLanguage,
  sourceLanguage,
}: WordInputProps) {
  const [text, setText] = useState("");
  const [screenshots, setScreenshots] = useState<ScreenshotDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function appendScreenshotFiles(files: File[]) {
    const remainingSlots = MAX_SCREENSHOTS - screenshots.length;

    if (remainingSlots <= 0) {
      setError(`You can attach up to ${MAX_SCREENSHOTS} screenshots.`);
      return;
    }

    const validFiles = files.slice(0, remainingSlots);
    const nextDrafts: ScreenshotDraft[] = [];

    for (const file of validFiles) {
      if (!isAcceptedImageType(file.type)) {
        setError("Only PNG, JPEG, and WEBP screenshots are supported.");
        continue;
      }

      if (file.size > MAX_SCREENSHOT_SIZE_BYTES) {
        setError("Each screenshot must be 5 MB or smaller.");
        continue;
      }

      const dataUrl = await readFileAsDataUrl(file);
      nextDrafts.push({
        id: createScreenshotId(),
        name:
          file.name ||
          `Screenshot ${screenshots.length + nextDrafts.length + 1}`,
        mimeType: file.type,
        dataUrl,
      });
    }

    if (nextDrafts.length > 0) {
      setError(null);
      setScreenshots((current) => [...current, ...nextDrafts]);
    }

    if (files.length > remainingSlots) {
      toast.error(`Only the first ${MAX_SCREENSHOTS} screenshots were kept.`);
    }
  }

  function handleFileSelection(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);

    if (files.length > 0) {
      void appendScreenshotFiles(files);
    }

    event.target.value = "";
  }

  function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const files = Array.from(event.clipboardData.items)
      .filter((item) => item.kind === "file")
      .map((item) => item.getAsFile())
      .filter((file): file is File => file !== null);

    if (files.length === 0) {
      return;
    }

    event.preventDefault();
    void appendScreenshotFiles(files);
  }

  function removeScreenshot(id: string) {
    setScreenshots((current) => current.filter((item) => item.id !== id));
  }

  async function handleParse() {
    if (!text.trim() && screenshots.length === 0) return;

    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch("/api/ai/parse-input", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.trim(),
          targetLanguage,
          sourceLanguage,
          screenshots: screenshots.map((screenshot) => ({
            mimeType: screenshot.mimeType,
            data: screenshot.dataUrl.split(",")[1] ?? "",
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to parse words");
      }

      const data = await res.json();
      onParsed(data.terms);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse words");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="word-input">Paste your vocabulary or notes</Label>
        <Textarea
          id="word-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onPaste={handlePaste}
          rows={8}
          disabled={isLoading}
          className="font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">
          You can paste text directly, upload screenshots, or paste a screenshot
          from your clipboard.
        </p>
      </div>

      <div className="space-y-3 rounded-lg border border-dashed bg-muted/20 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium">Add screenshots</p>
            <p className="text-xs text-muted-foreground">
              PNG, JPEG, or WEBP. Up to {MAX_SCREENSHOTS} screenshots, 5 MB
              each.
            </p>
          </div>
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_IMAGE_TYPES.join(",")}
              multiple
              onChange={handleFileSelection}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading || screenshots.length >= MAX_SCREENSHOTS}
              className="w-full sm:w-auto"
            >
              <ImagePlus className="mr-2 h-4 w-4" />
              Upload Screenshots
            </Button>
          </>
        </div>

        {screenshots.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {screenshots.map((screenshot, index) => (
              <div
                key={screenshot.id}
                className="overflow-hidden rounded-lg border bg-background"
              >
                <Image
                  src={screenshot.dataUrl}
                  alt={screenshot.name || `Screenshot ${index + 1}`}
                  width={640}
                  height={256}
                  unoptimized
                  className="h-32 w-full object-cover"
                />
                <div className="flex items-center justify-between gap-2 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {screenshot.name || `Screenshot ${index + 1}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Screenshot {index + 1}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeScreenshot(screenshot.id)}
                    disabled={isLoading}
                    className="h-8 w-8 shrink-0"
                  >
                    <X className="h-4 w-4" />
                    <span className="sr-only">Remove screenshot</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button
        onClick={handleParse}
        disabled={(!text.trim() && screenshots.length === 0) || isLoading}
        className="w-full"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Parsing vocabulary...
          </>
        ) : (
          <>
            <Sparkles className="mr-2 h-4 w-4" />
            Parse with AI
          </>
        )}
      </Button>
    </div>
  );
}
