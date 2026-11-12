# Sancar Games açılış sesi: özgün. Derin, yumuşak bir vuruş + ısınarak açılan Re majör akor + ince parıltı + salon yankısı. ~3,4 sn.
import numpy as np, wave, sys
sr=44100; D=3.6; n=int(sr*D); t=np.arange(n)/sr; rng=np.random.default_rng(7)
def env(a,p,d):  # a: yükseliş sn, p: tepe anı, d: sönüş sabiti
    e=np.clip(t/a,0,1)**2; e[t>p]*=np.exp(-(t[t>p]-p)/d); return e
def voice(f,pan):
    out=np.zeros((n,2))
    cut=500+3200*np.clip(t/1.8,0,1)**1.5          # ses açıldıkça parlaklaşır
    for det in (-7,0,6):
        ff=f*2**(det/1200); ph=rng.random()*6.28; s=np.zeros(n)
        for k in range(1,14):
            fk=ff*k
            if fk>9000: break
            s+=np.sin(2*np.pi*fk*t+ph*k)/k*(1/(1+(fk/cut)**4))   # testere dişine yakın, yumuşak alçak geçiren
        out[:,0]+=s*(1-pan)/3; out[:,1]+=s*pan/3
    return out
x=np.zeros((n,2))
for f,g,pan in [(73.42,.9,.5),(146.83,.8,.42),(220,.55,.6),(293.66,.6,.35),(369.99,.5,.66),(440,.42,.4),(587.33,.3,.6)]:
    x+=voice(f,pan)*g*env(1.5,1.75,1.0)[:,None]
# derin vuruş (başta): inen sinüs + yumuşak gövde
hit=np.sin(2*np.pi*(46*t+14*(1-np.exp(-t*9))/9))*np.exp(-t/.55)+.5*np.sin(2*np.pi*73.42*t)*np.exp(-t/.8)
x+=hit[:,None]*1.5*np.clip(t/.012,0,1)[:,None]
# parıltı: tepe anında iki çan notası
for f,t0,pan in [(1479.98,1.55,.3),(1760,1.72,.7),(2349.32,1.9,.5)]:
    tt=np.clip(t-t0,0,None); b=(np.sin(2*np.pi*f*tt)+.4*np.sin(2*np.pi*f*2.76*tt))*np.exp(-tt/.5)*(t>=t0)
    x[:,0]+=b*.11*(1-pan); x[:,1]+=b*.11*pan
# yankı: sönen gürültüyle evrişim
ir_n=int(sr*1.6); ti=np.arange(ir_n)/sr
wet=np.zeros_like(x)
for ch in (0,1):
    ir=rng.standard_normal(ir_n)*np.exp(-ti/.45); ir[:int(sr*.012)]=0
    wet[:,ch]=np.convolve(x[:,ch],ir)[:n]
wet/=np.abs(wet).max()+1e-9; x/=np.abs(x).max()+1e-9
y=.78*x+.42*wet
y*=np.clip((D-t)/.5,0,1)[:,None]            # sonda yumuşak kapanış
y=np.tanh(y*1.15); y/=np.abs(y).max(); y*=.84
w=wave.open(sys.argv[1],'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(sr); w.writeframes((y*32767).astype(np.int16).tobytes()); w.close()
