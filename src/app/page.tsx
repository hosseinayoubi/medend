import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export default function HomePage() {
  // اگر سشن شما با cookie ذخیره می‌شه، اینجا می‌تونی چکش کنی
  // اسم کوکی دقیق ممکنه فرق کنه (session / medend_session / token ...)
  const c = cookies();

  // اگر نمی‌دونی اسم کوکی چیه، فعلاً همیشه بفرست login
  // بعداً دقیقش می‌کنیم.
  const hasAnyCookie = c.getAll().length > 0;

  redirect(hasAnyCookie ? "/dashboard" : "/login");
}
