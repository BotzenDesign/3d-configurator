import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Box, Rocket, Bell, Github, Twitter, Mail } from "lucide-react";

export default function ComingSoon() {
  const [email, setEmail] = useState("");
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });

  // Example launch date: 30 days from now
  const launchDate = new Date();
  launchDate.setDate(launchDate.getDate() + 14);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date().getTime();
      const distance = launchDate.getTime() - now;

      setTimeLeft({
        days: Math.floor(distance / (1000 * 60 * 60 * 24)),
        hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((distance % (1000 * 60)) / 1000)
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleNotify = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    toast.success("Thanks! We'll notify you the moment we launch.");
    setEmail("");
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Dynamic Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px]" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-20 pointer-events-none" 
           style={{ backgroundImage: "radial-gradient(circle at 2px 2px, rgba(255,255,255,0.05) 1px, transparent 0)", backgroundSize: "40px 40px" }} />

      {/* Content Wrapper */}
      <div className="relative z-10 max-w-4xl w-full text-center space-y-12">
        {/* Logo & Badge */}
        <div className="space-y-4 flex flex-col items-center">
          <div className="p-3 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-xl mb-6 flex items-center gap-3">
             <Box className="w-8 h-8 text-primary animate-bounce-slow" />
             <span className="text-xl font-bold tracking-tighter">POLAR 3D</span>
          </div>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium">
            <Rocket className="w-4 h-4" />
            Launching Spring 2026
          </div>
        </div>

        {/* Hero Text */}
        <div className="space-y-6">
          <h1 className="text-6xl md:text-8xl font-black tracking-tight leading-[0.9] text-transparent bg-clip-text bg-gradient-to-b from-white to-white/40">
            THE FUTURE OF <br /> 3D CONFIGURATION.
          </h1>
          <p className="max-w-xl mx-auto text-white/50 text-lg md:text-xl font-light">
            An elite, production-grade 3D print configurator for your Shopify store. 
            Experience physics-accurate estimations and stunning visuals.
          </p>
        </div>

        {/* Countdown */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto">
          {[
            { label: "Days", value: timeLeft.days },
            { label: "Hours", value: timeLeft.hours },
            { label: "Minutes", value: timeLeft.minutes },
            { label: "Seconds", value: timeLeft.seconds }
          ].map((item) => (
            <div key={item.label} className="group relative p-6 bg-white/5 border border-white/10 rounded-3xl backdrop-blur-xl transition-all hover:bg-white/10">
               <div className="text-4xl md:text-5xl font-black tabular-nums">{String(item.value).padStart(2, '0')}</div>
               <div className="text-xs uppercase tracking-widest text-white/40 mt-1">{item.label}</div>
            </div>
          ))}
        </div>

        {/* Newsletter */}
        <div className="max-w-md mx-auto">
          <form onSubmit={handleNotify} className="flex gap-2 p-2 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-xl group hover:border-primary/30 transition-all">
            <Input 
              type="email" 
              placeholder="Enter your email" 
              className="bg-transparent border-none focus-visible:ring-0 text-white placeholder:text-white/20 h-12"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Button type="submit" className="rounded-xl h-12 px-8 bg-primary hover:bg-primary/90 text-white shadow-[0_0_20px_rgba(var(--primary-rgb),0.3)]">
              Notify Me
            </Button>
          </form>
          <div className="mt-4 flex items-center justify-center gap-2 text-white/30 text-xs">
            <Bell className="w-3 h-3" />
            We promise no spam, just the launch link.
          </div>
        </div>

        {/* Socials */}
        <div className="flex justify-center gap-6 text-white/40">
           <a href="#" className="hover:text-primary transition-colors"><Twitter className="w-6 h-6" /></a>
           <a href="#" className="hover:text-primary transition-colors"><Github className="w-6 h-6" /></a>
           <a href="#" className="hover:text-primary transition-colors"><Mail className="w-6 h-6" /></a>
        </div>
      </div>

      {/* Footer Branding */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/20 text-[10px] uppercase tracking-[0.2em]">
        &copy; 2026 Polar 3D Labs. All Rights Reserved.
      </div>

      <style>{`
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .animate-bounce-slow {
          animation: bounce-slow 4s infinite ease-in-out;
        }
      `}</style>
    </div>
  );
}
