export default function QALayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full min-h-0 overflow-y-auto overscroll-y-auto">{children}</div>
  );
}
