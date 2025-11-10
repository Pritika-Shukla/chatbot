import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { key } = await request.json();

  if (key === process.env.ADMIN_KEY) {
    const res = NextResponse.json({ message: "Login successful" });

    res.cookies.set("admin", "true", {
      httpOnly: true,
      sameSite: "strict",
      path: "/",
      secure: process.env.NODE_ENV === "production",
    });

    return res;
  }

  return NextResponse.json({ message: "Invalid key" }, { status: 401 });
}