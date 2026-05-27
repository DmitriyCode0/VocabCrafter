"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { StudentSkillRadar } from "@/components/progress/student-skill-radar";
import type {
  GrammarTopicMasteryItem,
  StudentProgressAxis,
} from "@/lib/progress/profile-metrics";

interface TutorEditableStudentSkillRadarProps {
  studentId: string;
  axes: StudentProgressAxis[];
  chartData: Array<{
    axis: string;
    score: number;
    fullMark: number;
  }>;
  cefrLevel: string;
  grammarNotice: string;
  grammarTopics: GrammarTopicMasteryItem[];
}

export function TutorEditableStudentSkillRadar({
  studentId,
  axes,
  chartData,
  cefrLevel,
  grammarNotice,
  grammarTopics,
}: TutorEditableStudentSkillRadarProps) {
  const router = useRouter();
  const [topics, setTopics] = useState(grammarTopics);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setTopics(grammarTopics);
  }, [grammarTopics]);

  async function handleGrammarTopicToggle(topicKey: string, checked: boolean) {
    setIsSaving(true);

    try {
      const response = await fetch(
        `/api/tutor/students/${studentId}/grammar-topics`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topicKey, marked: checked }),
        },
      );

      const data = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(data?.error || "Failed to update grammar topic");
      }

      setTopics((currentTopics) =>
        currentTopics.map((topic) =>
          topic.topicKey === topicKey
            ? {
                ...topic,
                mastered: checked,
                source: checked ? "tutor" : null,
              }
            : topic,
        ),
      );
      toast.success(
        checked
          ? "Grammar topic marked as learned."
          : "Grammar topic marked as not learned.",
      );
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to update grammar topic",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <StudentSkillRadar
      axes={axes}
      chartData={chartData}
      cefrLevel={cefrLevel}
      grammarNotice={grammarNotice}
      grammarTopics={topics}
      grammarTopicsEditable
      grammarTopicsDisabled={isSaving}
      onGrammarTopicToggle={handleGrammarTopicToggle}
    />
  );
}