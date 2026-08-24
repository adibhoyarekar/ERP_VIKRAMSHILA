export default function Header() {
  return (
    <header className="flex flex-col md:flex-row items-center justify-center py-4 md:py-8 px-4 bg-white border-b-4 border-b-slate-900 shadow-sm relative z-20 gap-3 md:gap-8 max-w-full overflow-hidden">
      {/* Logo Section */}
      <div className="w-16 sm:w-24 md:w-36 h-auto flex items-center justify-center shrink-0 drop-shadow-sm">
        <img 
          src="/logo.png" 
          alt="Vikramshila College Of Fashion Design Logo" 
          className="w-full h-auto object-contain max-h-24 md:max-h-32"
        />
      </div>

      {/* Center Title */}
      <div className="text-center space-y-1.5 md:space-y-3 px-2 max-w-full">
        <h1 className="text-xl sm:text-2xl md:text-4xl xl:text-5xl font-serif font-bold text-slate-900 tracking-tight leading-tight uppercase">
          Vikramshila College <span className="text-sky-700 font-sans font-extrabold tracking-tighter">Of Fashion Design</span>
        </h1>
        <div className="flex items-center justify-center gap-3 md:gap-4 text-slate-600">
          <div className="h-px w-8 sm:w-12 bg-slate-300"></div>
          <p className="text-sm sm:text-lg md:text-2xl font-sanskrit font-bold text-sky-800 tracking-wide drop-shadow-sm">
            अत्त दीप भव
          </p>
          <div className="h-px w-8 sm:w-12 bg-slate-300"></div>
        </div>
      </div>
    </header>
  );
}
