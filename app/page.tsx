'use client'

import { useRouter } from 'next/navigation'
import React, { useState } from 'react'

const LoginPage = () => {
  const [key, setKey] = useState('')
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const res=await fetch('/api/login', {
      method: 'POST',
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key })
    })

    if (res.ok) {
      router.push('/chatbot')
    } else {
     alert('Login failed')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Admin Login
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Enter your access key to continue
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="key" className="sr-only">
              Access Key
            </label>
            <input
              id="key"
              name="key"
              type="password"
              required
              className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
              placeholder="Enter access key"
              value={key}
              onChange={(e) => setKey(e.target.value)}
            />
          </div>

          <div>
            <button
              type="submit"
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              disabled={!key.trim()}
            >
              Login
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default LoginPage