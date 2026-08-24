import { Home, FileText, CheckSquare, Award, Archive, CreditCard, Users, LayoutDashboard } from 'lucide-react';

export default function Navbar() {
  const navItems = [
    { name: 'Home', icon: <Home size={16} /> },
    { name: 'Admission', icon: <FileText size={16} /> },
    { name: 'Assessment', icon: <CheckSquare size={16} /> },
    { name: 'Award', icon: <Award size={16} /> },
    { name: 'Archive', icon: <Archive size={16} /> },
    { name: 'Fee', icon: <CreditCard size={16} /> },
    { name: 'DoSA', icon: <Users size={16} /> },
    { name: 'Admin Dashboard', icon: <LayoutDashboard size={16} /> },
  ];

  return (
    <nav className="bg-white border-b border-slate-200/80 shadow-[0_4px_12px_rgba(0,0,0,0.01)] overflow-x-auto sticky top-0 z-10">
      <div className="flex items-center px-6 md:px-12 min-w-max">
        {navItems.map((item, idx) => (
          <a
            key={idx}
            href="#"
            className="flex items-center gap-2.5 px-5 py-4 text-sm font-semibold text-slate-600 hover:text-sky-700 hover:bg-slate-50 transition-all border-b-[3px] border-transparent hover:border-sky-500 group"
          >
            <span className="text-slate-400 group-hover:text-sky-500 transition-colors">
              {item.icon}
            </span>
            <span className="tracking-wide uppercase text-xs">{item.name}</span>
          </a>
        ))}
      </div>
    </nav>
  );
}
