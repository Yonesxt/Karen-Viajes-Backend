/** @type {import('next').NextConfig} */
const nextConfig = {
  // Este proyecto es solo API (no tiene páginas). Se ocultan datos de la plataforma.
  poweredByHeader: false,
  // "pg" usa módulos nativos de Node: que Next no intente empaquetarlo.
  experimental: { serverComponentsExternalPackages: ['pg'] },
}
export default nextConfig
