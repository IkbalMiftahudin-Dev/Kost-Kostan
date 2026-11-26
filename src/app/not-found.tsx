import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-[100dvh] bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center">
      <div className="text-5xl font-extrabold text-sky-400">404</div>
      <h1 className="text-xl font-bold text-white mt-3">Halaman Tidak Ditemukan</h1>
      <p className="text-sm text-slate-400 mt-1 max-w-sm">
        Halaman yang Anda cari tidak tersedia di sistem Kontrakan Teh Amoy.
      </p>
      <Link
        href="/"
        className="mt-6 px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-sm font-bold transition"
      >
        Kembali ke Tampilan 3D
      </Link>
    </div>
  );
}
