import copy
from fontTools.ttLib import TTFont
from fontTools.ttLib.tables._g_l_y_f import Glyph, GlyphCoordinates
from fontTools.ttLib.tables.TupleVariation import TupleVariation
f=TTFont(__import__('sys').argv[1]); glyf=f['glyf']; gvar=f['gvar']; hmtx=f['hmtx']
def coords(n):
    g=glyf[n]; c,e,fl=g.getCoordinates(glyf); return list(c), list(e), fl
Ic,Ie,If=coords('I'); Dc,De,Df=coords('Idotaccent')
# İ konturlarını ayır: büyük harf yüksekliğinin üstündekiler nokta
cap=max(y for x,y in Ic)
starts=[0]+[e+1 for e in De[:-1]]
dot_idx=[];stem_idx=[]
for s,e in zip(starts,De):
    pts=range(s,e+1)
    (dot_idx if min(Dc[i][1] for i in pts)>=cap-5 else stem_idx).append((s,e))
print('dot contours',dot_idx,'stem',stem_idx,'cap',cap)
def full(var,orig,ends):
    d=var.coordinates
    if any(v is None for v in d): var=copy.deepcopy(var); var.calcInferredDeltas(orig+[(0,0)]*4,ends); d=var.coordinates
    return d
Iv=gvar.variations['I']; Dv=gvar.variations['Idotaccent']
ix=[x for x,y in Ic]; iL=ix.index(min(ix)); iR=ix.index(max(ix))
sp=[i for s,e in stem_idx for i in range(s,e+1)]; sx=[Dc[i][0] for i in sp]; sL=sp[sx.index(min(sx))]; sR=sp[sx.index(max(sx))]
dp=[i for s,e in dot_idx for i in range(s,e+1)]
shift0=(Ic[iL][0]+Ic[iR][0])/2-(Dc[sL][0]+Dc[sR][0])/2
# yeni glif: I noktaları + nokta konturu
newc=Ic+[(Dc[i][0]+shift0,Dc[i][1]) for i in dp]
newe=list(Ie); off=len(Ic)
for s,e in dot_idx: off+=e-s+1; newe.append(off-1)
newf=list(If)+[Df[i] for i in dp]
# eşleşen bölgeler: İ'nin ve I'nın gvar bölgeleri aynı olmalı
def key(v): return tuple(sorted(v.axes.items()))
Dmap={key(v):full(v,Dc,De) for v in Dv}
newvars=[]
for v in Iv:
    Id=full(v,Ic,Ie); k=key(v)
    Dd=Dmap.get(k)
    if Dd is None: dd=[(0,0)]*len(dp); print('no match',k)
    else:
        sh=(Id[iL][0]+Id[iR][0])/2-(Dd[sL][0]+Dd[sR][0])/2
        dd=[(Dd[i][0]+sh,Dd[i][1]) for i in dp]
    pts=list(Id[:len(Ic)])+dd+list(Id[len(Ic):])
    newvars.append(TupleVariation(dict(v.axes),[(round(x),round(y)) for x,y in pts]))
missing=set(Dmap)-{key(v) for v in Iv}; print('D-only regions',len(missing))
g=Glyph(); g.numberOfContours=len(newe); g.coordinates=GlyphCoordinates([(round(x),round(y)) for x,y in newc]); g.endPtsOfContours=newe; g.flags=bytearray(newf); g.program=copy.deepcopy(glyf['I'].program) if hasattr(glyf['I'],'program') else None
if g.program is None: del g.program
glyf['Idotaccent']=g; glyf['Idotaccent'].recalcBounds(glyf)
gvar.variations['Idotaccent']=newvars
hmtx['Idotaccent']=(hmtx['I'][0],glyf['Idotaccent'].xMin)
if 'HVAR' in f:
    # HVAR'da İ'nin genişlik değişimini I ile aynı yap
    h=f['HVAR'].table
    if h.AdvWidthMap: h.AdvWidthMap.mapping['Idotaccent']=h.AdvWidthMap.mapping['I']
    else: print('HVAR implicit mapping')
f.save(__import__('sys').argv[2])
