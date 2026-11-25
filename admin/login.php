<?php
declare(strict_types=1);
require_once __DIR__ . '/../config/helpers.php';

if (isAdminLoggedIn()) {
    header('Location: index.php');
    exit;
}
?>
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>Login Admin — Kontrakan Teh Amoy</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; }
  </style>
</head>
<body class="min-h-[100dvh] bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 flex items-center justify-center p-4 sm:p-6">

  <div class="w-full max-w-md">
    <div class="bg-slate-900/85 backdrop-blur-xl border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl">
      <div class="text-center mb-6 sm:mb-7">
        <div class="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center text-white text-2xl shadow-lg shadow-blue-600/30 mb-4">
          <i class="fa-solid fa-house-lock"></i>
        </div>
        <h1 class="text-xl sm:text-2xl font-extrabold text-white tracking-tight">Admin Kontrakan</h1>
        <p class="text-xs sm:text-sm text-slate-400 mt-1">Kontrakan Teh Amoy • Panel Manajemen</p>
      </div>

      <div id="login-error" class="hidden mb-4 p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2">
        <i class="fa-solid fa-circle-exclamation text-rose-400 shrink-0"></i>
        <span id="login-error-text"></span>
      </div>

      <form id="login-form" class="space-y-4">
        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1.5">Username</label>
          <div class="relative">
            <i class="fa-solid fa-user absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
            <input id="username" type="text" required autocomplete="username" placeholder="Masukkan username"
              class="w-full bg-slate-950/75 border border-white/15 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-400 transition">
          </div>
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1.5">Password</label>
          <div class="relative">
            <i class="fa-solid fa-key absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
            <input id="password" type="password" required autocomplete="current-password" placeholder="Masukkan password"
              class="w-full bg-slate-950/75 border border-white/15 rounded-xl pl-10 pr-11 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-400 transition">
            <button id="toggle-pass" type="button" aria-label="Tampilkan Password"
              class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1.5 transition">
              <i class="fa-solid fa-eye text-sm"></i>
            </button>
          </div>
        </div>

        <button id="btn-submit" type="submit"
          class="w-full bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold py-3.5 rounded-xl text-sm shadow-lg shadow-blue-600/30 transition flex items-center justify-center gap-2">
          <i class="fa-solid fa-right-to-bracket"></i>
          <span>Masuk Dashboard</span>
        </button>
      </form>

      <div class="mt-6 pt-5 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400">
        <a href="../index.php" class="hover:text-sky-300 transition flex items-center gap-1.5 font-medium">
          <i class="fa-solid fa-arrow-left"></i>
          <span>Kembali ke 3D User</span>
        </a>
        <span class="text-slate-500">Default: <code class="text-slate-300">admin</code> / <code class="text-slate-300">admin123</code></span>
      </div>
    </div>
  </div>

  <script>
    const form = document.getElementById('login-form');
    const errBox = document.getElementById('login-error');
    const errText = document.getElementById('login-error-text');
    const btn = document.getElementById('btn-submit');
    const passInput = document.getElementById('password');
    const togglePass = document.getElementById('toggle-pass');

    togglePass.addEventListener('click', () => {
      const isHidden = passInput.type === 'password';
      passInput.type = isHidden ? 'text' : 'password';
      togglePass.innerHTML = isHidden ? '<i class="fa-solid fa-eye-slash text-sm"></i>' : '<i class="fa-solid fa-eye text-sm"></i>';
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errBox.classList.add('hidden');
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span>Memproses...</span>';

      try {
        const res = await fetch('../api/auth.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'login',
            username: document.getElementById('username').value.trim(),
            password: passInput.value
          })
        });
        const data = await res.json();
        if (!data.success) {
          throw new Error(data.message || 'Login gagal.');
        }
        window.location.href = 'index.php';
      } catch (err) {
        errText.textContent = err.message;
        errBox.classList.remove('hidden');
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i><span>Masuk Dashboard</span>';
      }
    });
  </script>
</body>
</html>
