export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="animate-page-enter w-full max-w-md lg:max-w-xl xl:max-w-2xl">
        {children}
      </div>
    </div>
  );
}
