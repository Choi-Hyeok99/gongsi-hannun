import type { Metadata } from "next";
import React from "react";
import { notFound, redirect } from "next/navigation";
import { AdminDashboardView } from "@/components/AdminDashboardView";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { readAdminAccess } from "@/server/admin-access";
import { readAdminDashboard } from "@/server/admin-dashboard";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = {title:"운영 대시보드 | 공시한눈",robots:{index:false,follow:false}};
export default async function AdminPage() {
  const access = await readAdminAccess();
  if (access === "SIGN_IN") redirect("/login?next=%2Fadmin");
  if (access !== "ADMIN") notFound();
  const data = await readAdminDashboard();
  return <div className="site-shell"><SiteHeader /><main className="content-container page-content"><AdminDashboardView data={data} /></main><SiteFooter /></div>;
}
