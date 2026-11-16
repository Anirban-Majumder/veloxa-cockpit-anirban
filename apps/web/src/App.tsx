import { useState } from 'react'

export default function App() {
  const [count, setCount] = useState(0)

  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-slate-100">
      <section className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-xl">
        <p className="text-sm font-medium tracking-widest text-teal-400 uppercase">
          Veloxa Cockpit
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">Hello, world.</h1>
        <p className="mt-4 text-slate-300">
          React, Vite and Tailwind CSS are ready.
        </p>
        <button
          type="button"
          className="mt-8 rounded-lg bg-teal-400 px-4 py-2 font-medium text-slate-950 hover:bg-teal-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-400"
          onClick={() => setCount((value) => value + 1)}
        >
          Count: {count}
        </button>
      </section>
    </main>
  )
}
