import ImageUpload from '@/components/ImageUpload'

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-xl flex-col items-center justify-center gap-8 px-6 py-16">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-foreground text-balance">
            BetaFinder
          </h1>
          <p className="mt-2 text-lg text-muted-foreground">
            Upload a climbing wall photo to detect holds and generate beta
          </p>
        </div>
        <ImageUpload />
      </main>
    </div>
  )
}
