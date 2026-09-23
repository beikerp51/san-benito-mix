import React from 'react';

interface BankLogoProps {
  name: string;
  size?: number;
  className?: string;
}

export const BankLogo: React.FC<BankLogoProps> = ({ name, size = 36, className = '' }) => {
  const normalized = (name || '').toLowerCase().trim();

  // 1. BANESCO BANCO UNIVERSAL (Official Brand Identity: Green tile + White Banesco wordmark + Lime green accent bar)
  if (normalized.includes('banesco')) {
    return (
      <div
        className={`inline-flex items-center justify-center rounded-xl overflow-hidden shadow-sm flex-shrink-0 select-none ${className}`}
        style={{
          width: size,
          height: size,
          background: '#007953', // Official Banesco Corporate Green
        }}
        title="Banesco Banco Universal"
      >
        <svg
          viewBox="0 0 48 48"
          width={size * 0.9}
          height={size * 0.9}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Subtle top gloss */}
          <rect x="2" y="2" width="44" height="20" rx="8" fill="white" fillOpacity="0.05" />
          
          {/* Banesco Official Typography Wordmark */}
          <text
            x="24"
            y="26"
            textAnchor="middle"
            fill="#FFFFFF"
            fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
            fontWeight="900"
            fontSize="10"
            letterSpacing="-0.3px"
          >
            Banesco
          </text>

          {/* Official Banesco Signature Lime Green Accent Bar */}
          <rect x="8" y="30" width="32" height="3" rx="1.5" fill="#96DB0B" />
        </svg>
      </div>
    );
  }

  // 2. BANCO DE VENEZUELA (BDV) (Official Brand Identity: Navy Blue tile + Bold BDV Monogram + Official Yellow & Red chevrons)
  if (normalized.includes('venezuela') || normalized.includes('bdv')) {
    return (
      <div
        className={`inline-flex items-center justify-center rounded-xl overflow-hidden shadow-sm flex-shrink-0 select-none ${className}`}
        style={{
          width: size,
          height: size,
          background: 'linear-gradient(135deg, #002855 0%, #001A38 100%)', // Official BDV Navy Blue
        }}
        title="Banco de Venezuela"
      >
        <svg
          viewBox="0 0 48 48"
          width={size * 0.9}
          height={size * 0.9}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* BDV Bold Typography */}
          <text
            x="24"
            y="24"
            textAnchor="middle"
            fill="#FFFFFF"
            fontFamily="system-ui, -apple-system, sans-serif"
            fontWeight="900"
            fontSize="13.5"
            letterSpacing="0.8px"
          >
            BDV
          </text>

          {/* Official BDV Chevrons (Yellow & Red) */}
          <path
            d="M10 29C15 32 33 32 38 29"
            stroke="#FFD100"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="M14 34C18 36.5 30 36.5 34 34"
            stroke="#E31D24"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      </div>
    );
  }

  // 3. BINANCE (Official Brand Identity: Charcoal Dark Mode + Official Binance Yellow Interlocking Diamonds)
  if (
    normalized.includes('binance') ||
    normalized.includes('crypto') ||
    normalized.includes('usdt')
  ) {
    return (
      <div
        className={`inline-flex items-center justify-center rounded-xl overflow-hidden shadow-sm flex-shrink-0 select-none ${className}`}
        style={{ width: size, height: size, background: '#181A20' }}
        title="Binance Pay (USDT)"
      >
        <svg
          viewBox="0 0 48 48"
          width={size * 0.75}
          height={size * 0.75}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M24 8L29 13L19 23L14 18L24 8Z" fill="#F0B90B" />
          <path d="M24 40L29 35L19 25L14 30L24 40Z" fill="#F0B90B" />
          <path d="M35 19L40 24L30 34L25 29L35 19Z" fill="#F0B90B" />
          <path d="M35 29L40 24L30 14L25 19L35 29Z" fill="#F0B90B" />
          <path d="M24 20.5L27.5 24L24 27.5L20.5 24L24 20.5Z" fill="#F0B90B" />
        </svg>
      </div>
    );
  }

  // 4. BANCO NACIONAL DE CRÉDITO (BNC) (Official Brand Identity: BNC Green + Bold BNC White + Dynamic Orange Slash)
  if (
    normalized.includes('nacional de cr') ||
    normalized.includes('nacional de credito') ||
    normalized.includes('bnc')
  ) {
    return (
      <div
        className={`inline-flex items-center justify-center rounded-xl overflow-hidden shadow-sm flex-shrink-0 select-none ${className}`}
        style={{
          width: size,
          height: size,
          background: 'linear-gradient(135deg, #005C42 0%, #003828 100%)', // Official BNC Green
        }}
        title="Banco Nacional de Crédito (BNC)"
      >
        <svg
          viewBox="0 0 48 48"
          width={size * 0.9}
          height={size * 0.9}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* BNC Official Lettering */}
          <text
            x="20"
            y="26"
            textAnchor="middle"
            fill="#FFFFFF"
            fontFamily="system-ui, -apple-system, sans-serif"
            fontWeight="900"
            fontSize="13"
            letterSpacing="-0.2px"
          >
            BNC
          </text>

          {/* Official Orange Dynamic Stroke */}
          <path
            d="M34 11L38 35"
            stroke="#FF6B35"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
          <path
            d="M8 31C16 34 26 34 32 31"
            stroke="#FF6B35"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </div>
    );
  }

  // 5. BANCO MERCANTIL (Official Brand Identity: Royal Blue + Iconic Orange Globe Sphere + Intersecting White Orbits)
  if (normalized.includes('mercantil')) {
    return (
      <div
        className={`inline-flex items-center justify-center rounded-xl overflow-hidden shadow-sm flex-shrink-0 select-none ${className}`}
        style={{
          width: size,
          height: size,
          background: 'linear-gradient(135deg, #002868 0%, #001844 100%)', // Official Mercantil Royal Blue
        }}
        title="Banco Mercantil"
      >
        <svg
          viewBox="0 0 48 48"
          width={size * 0.8}
          height={size * 0.8}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Mercantil iconic orange circle */}
          <circle cx="28" cy="20" r="7.5" fill="#FF6600" />
          
          {/* Intersecting white swooshing orbits */}
          <path
            d="M12 25C14 16 21 12 28 14C35 16 36 23 32 29C28 35 18 35 13 28"
            stroke="#FFFFFF"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <path
            d="M9 28C11 34 17 38 26 37"
            stroke="#FF6600"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      </div>
    );
  }

  // 6. BANCO DIGITAL DE LOS TRABAJADORES (BDT) (Official 2024 Brand Identity: Modern Tech Navy + Bold BDT Monogram + Electric Cyan Waves)
  if (
    normalized.includes('trabajadores') ||
    normalized.includes('bdt') ||
    normalized.includes('bicentenario')
  ) {
    return (
      <div
        className={`inline-flex items-center justify-center rounded-xl overflow-hidden shadow-sm flex-shrink-0 select-none ${className}`}
        style={{
          width: size,
          height: size,
          background: 'linear-gradient(135deg, #0D1B2A 0%, #1B263B 100%)', // Official BDT Tech Slate
        }}
        title="Banco Digital de los Trabajadores (BDT)"
      >
        <svg
          viewBox="0 0 48 48"
          width={size * 0.9}
          height={size * 0.9}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Digital Network Waves */}
          <path d="M8 17C14 12 22 12 28 16" stroke="#00D2D3" strokeWidth="2.5" strokeLinecap="round" />
          
          {/* BDT Bold Typography */}
          <text
            x="22"
            y="28"
            textAnchor="middle"
            fill="#FFFFFF"
            fontFamily="system-ui, -apple-system, sans-serif"
            fontWeight="900"
            fontSize="13"
            letterSpacing="0.5px"
          >
            BDT
          </text>

          {/* Digital Status Nodes */}
          <circle cx="38" cy="18" r="2.8" fill="#E63946" />
          <circle cx="36" cy="27" r="2.2" fill="#00D2D3" />
        </svg>
      </div>
    );
  }

  // 7. EFECTIVO EN BOLÍVARES (VES Cash / Legal Tender with National Tricolor Ribbon & Bs. Denomination)
  if (
    normalized.includes('bolivares') ||
    normalized.includes('bolívares') ||
    (normalized.includes('efectivo') && normalized.includes('ves')) ||
    normalized.includes('efectivo en bol')
  ) {
    return (
      <div
        className={`inline-flex items-center justify-center rounded-xl overflow-hidden shadow-sm flex-shrink-0 select-none ${className}`}
        style={{
          width: size,
          height: size,
          background: 'linear-gradient(135deg, #0F4C3A 0%, #08281E 100%)', // National Currency Teal
        }}
        title="Efectivo en Bolívares (VES)"
      >
        <svg
          viewBox="0 0 48 48"
          width={size * 0.82}
          height={size * 0.82}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Banknote Border */}
          <rect x="4" y="9" width="40" height="30" rx="4.5" fill="#093B2C" stroke="#00C48C" strokeWidth="1.8" />
          <rect x="7" y="12" width="34" height="24" rx="2.5" stroke="rgba(255,255,255,0.25)" strokeWidth="1" strokeDasharray="2.5 1.5" fill="none" />
          
          {/* Venezuelan Flag Miniature Band */}
          <rect x="18" y="16" width="12" height="1.4" rx="0.5" fill="#FFCC00" />
          <rect x="18" y="17.4" width="12" height="1.4" rx="0.5" fill="#0033A0" />
          <rect x="18" y="18.8" width="12" height="1.4" rx="0.5" fill="#CF142B" />

          {/* Bs. Denomination */}
          <text
            x="24"
            y="29.5"
            textAnchor="middle"
            fill="#FFFFFF"
            fontFamily="monospace, system-ui, sans-serif"
            fontWeight="900"
            fontSize="10"
            letterSpacing="-0.2px"
          >
            Bs.
          </text>
        </svg>
      </div>
    );
  }

  // 8. EFECTIVO DIVISAS (USD Cash / Vault Currency with Federal Guilloché & $ USD Gold Seal)
  if (
    normalized.includes('divisas') ||
    normalized.includes('dolar') ||
    normalized.includes('dólar') ||
    normalized.includes('caja chica') ||
    (normalized.includes('efectivo') && !normalized.includes('bol'))
  ) {
    return (
      <div
        className={`inline-flex items-center justify-center rounded-xl overflow-hidden shadow-sm flex-shrink-0 select-none ${className}`}
        style={{
          width: size,
          height: size,
          background: 'linear-gradient(135deg, #064E3B 0%, #022416 100%)', // Federal Reserve Green
        }}
        title="Efectivo Divisas ($ USD)"
      >
        <svg
          viewBox="0 0 48 48"
          width={size * 0.82}
          height={size * 0.82}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Federal Banknote Frame */}
          <rect x="4" y="9" width="40" height="30" rx="4.5" fill="#053823" stroke="#10B981" strokeWidth="1.8" />
          <rect x="7" y="12" width="34" height="24" rx="2.5" stroke="#34D399" strokeWidth="1" strokeDasharray="3 1.5" fill="none" />
          
          {/* Golden Seal */}
          <circle cx="24" cy="24" r="9" fill="#064E3B" stroke="#F59E0B" strokeWidth="1.8" />
          
          {/* Dollar Sign in Gold */}
          <path
            d="M24 16.5V31.5M21.5 19.5H25.5C26.5 19.5 27.2 20.2 27.2 21C27.2 21.8 26.5 22.5 25.5 22.5H22.5C21.5 22.5 20.8 23.2 20.8 24C20.8 24.8 21.5 25.5 22.5 25.5H26.5"
            stroke="#FBBF24"
            strokeWidth="2.2"
            strokeLinecap="round"
          />

          {/* Mint Stars */}
          <circle cx="10" cy="15" r="1.3" fill="#F59E0B" />
          <circle cx="38" cy="15" r="1.3" fill="#F59E0B" />
          <circle cx="10" cy="33" r="1.3" fill="#F59E0B" />
          <circle cx="38" cy="33" r="1.3" fill="#F59E0B" />
        </svg>
      </div>
    );
  }

  // Fallback Generic Banking Vault
  return (
    <div
      className={`inline-flex items-center justify-center rounded-xl overflow-hidden shadow-sm flex-shrink-0 select-none ${className}`}
      style={{
        width: size,
        height: size,
        background: 'linear-gradient(135deg, #475569 0%, #1E293B 100%)',
      }}
      title={name}
    >
      <svg
        viewBox="0 0 24 24"
        width={size * 0.6}
        height={size * 0.6}
        fill="none"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="3" y1="21" x2="21" y2="21" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <polyline points="5 10 5 21" />
        <polyline points="19 10 19 21" />
        <polyline points="10 10 10 21" />
        <polyline points="14 10 14 21" />
        <polygon points="12 2 20 7 4 7" />
      </svg>
    </div>
  );
};

export default BankLogo;
