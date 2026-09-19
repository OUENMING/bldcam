"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function LoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return; // re-entry guard: Enter twice fired two requests
    if (!password) {
      toast.error("请输入密码");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        toast.success("已登入");
        // A refresh alone does not change the route, so a session already sitting on
        // /admin stayed on the form with its auth state out of step.
        router.replace("/admin");
        router.refresh();
      } else if (res.status === 401 || res.status === 403) {
        toast.error("密码错误");
      } else {
        // A 500 or a throttled 429 is not a wrong password, and saying it is sends
        // the user off to re-check something that was never wrong.
        toast.error("登录失败，请稍后重试");
      }
    } catch {
      toast.error("网络错误");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm shadow-xl">
        <CardHeader>
          <CardTitle className="text-center tracking-tight">
            BLDcam
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              id="admin-password"
              type="password"
              placeholder="Password"
              // Without the id, the autocomplete hint and the accessible name, a
              // screen reader announces an unlabelled field and password managers
              // have nothing to key the saved credential on.
              aria-label="管理员密码"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              disabled={loading}
            />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "验证中…" : "登录"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
