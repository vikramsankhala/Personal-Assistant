import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "VPA - Virtual Stenographer & Personal Assistant",
  description: "Real-time transcription, speaker diarization, and AI-powered assistant",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-ink-900 font-sans antialiased">
        {children}
                  <div style={{position:'fixed',bottom:'16px',right:'16px',zIndex:9999,display:'flex',alignItems:'center',gap:'10px',background:'rgba(10,22,40,0.92)',border:'1px solid rgba(201,168,76,0.3)',borderRadius:'40px',padding:'8px 16px 8px 8px',backdropFilter:'blur(8px)'}}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="https://github.com/vikramsankhala.png" alt="Vikram Sankhala" style={{width:'36px',height:'36px',borderRadius:'50%',objectFit:'cover',border:'1px solid #C9A84C'}} />
            <div style={{display:'flex',flexDirection:'column'}}>
              <span style={{fontFamily:'serif',fontSize:'13px',fontWeight:700,color:'#F8F6F1',lineHeight:1.2}}>Vikram Sankhala</span>
              <span style={{fontFamily:'monospace',fontSize:'10px',color:'#8A94A6',letterSpacing:'0.05em'}}>Founder &amp; CEO</span>
            </div>
          </div>
      </body>
    </html>
  );
}
