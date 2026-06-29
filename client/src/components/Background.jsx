export default function Background() {
  return (
    <>
      {/* Primary deep-navy-to-blue gradient — matches level-match.com */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          background:
            'linear-gradient(180deg, #010F24 0%, #02367B 28%, #006CA5 55%, #02367B 78%, #010F24 100%)',
        }}
      />

      {/* Ambient glow blobs */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div
          className="absolute animate-ambient-pulse"
          style={{
            width: '70vw', height: '70vw',
            top: '-15vw', left: '-15vw',
            background: 'radial-gradient(circle, rgba(2,54,123,0.65) 0%, transparent 70%)',
            filter: 'blur(90px)',
          }}
        />
        <div
          className="absolute animate-ambient-pulse"
          style={{
            width: '55vw', height: '55vw',
            top: '15vh', right: '-12vw',
            background: 'radial-gradient(circle, rgba(4,150,199,0.28) 0%, transparent 70%)',
            filter: 'blur(80px)',
            animationDelay: '2.5s',
          }}
        />
        <div
          className="absolute animate-ambient-pulse"
          style={{
            width: '65vw', height: '65vw',
            top: '45vh', left: '10vw',
            background: 'radial-gradient(circle, rgba(0,108,165,0.35) 0%, transparent 70%)',
            filter: 'blur(100px)',
            animationDelay: '4s',
          }}
        />
        <div
          className="absolute animate-ambient-pulse"
          style={{
            width: '50vw', height: '50vw',
            bottom: '0', right: '5vw',
            background: 'radial-gradient(circle, rgba(4,186,222,0.18) 0%, transparent 70%)',
            filter: 'blur(80px)',
            animationDelay: '1s',
          }}
        />
      </div>

      {/* Grain / noise texture */}
      <div
        className="fixed inset-0 pointer-events-none z-0 animate-grain"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '180px 180px',
          opacity: 0.025,
          mixBlendMode: 'overlay',
        }}
      />

      {/* Cinematic vignette */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          background: 'radial-gradient(ellipse at 50% 40%, transparent 45%, rgba(1,15,36,0.65) 100%)',
        }}
      />
    </>
  )
}
