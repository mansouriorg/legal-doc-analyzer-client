// app/loading.tsx
export default function Loading() {
  return (
    <div className="flex-grow flex items-center justify-center bg-slate-50">
      <div role="status" className="animate-spin motion-reduce:animate-none rounded-full h-12 w-12 border-b-2 border-blue-600">
        <span className="sr-only">Loading</span>
      </div>
    </div>
  );
}
