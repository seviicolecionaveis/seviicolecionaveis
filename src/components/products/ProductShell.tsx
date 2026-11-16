import { Link } from '@tanstack/react-router';
import { SiteNav } from '@/components/SiteNav';
import { SiteFooter } from '@/components/SiteFooter';
import logoUrl from '@/assets/logo.webp';
export function ProductShell({children}:{children:React.ReactNode}) {return <div className="min-h-screen text-foreground"><header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md"><div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6"><Link to="/"><img src={logoUrl} alt="Sevii Colecionáveis" className="h-12 w-auto sm:h-14"/></Link><SiteNav className="hidden md:flex"/></div><div className="border-t border-border px-4 py-3 md:hidden"><SiteNav className="-mx-1 overflow-x-auto"/></div></header>{children}<SiteFooter/></div>;}
