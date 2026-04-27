import { redirect } from "next/navigation";

export default async function ReviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/assignments/review/${id}`);
}
