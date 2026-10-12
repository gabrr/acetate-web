import { redirect } from "next/navigation";

export default function LoginPage() {
  redirect((process.env.AUTH_LANDING_ORIGIN || "https://www.acetate.me") + "/#sign-in");
}
