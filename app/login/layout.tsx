// 登入頁不套用 root layout（不顯示 NavBar）
export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
