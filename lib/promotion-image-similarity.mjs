/**
 * Compare already-decoded RGBA images. This is a review signal only.
 * Callers must decode and resize images before invoking this function.
 * It cannot prove publication on any social network.
 */
export function grayscaleGrid({width,height,data},size=16){
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||
    !data||data.length!==width*height*4||!Number.isInteger(size)||size<2||size>64)
  throw new TypeError('Invalid RGBA image or grid size')
 const result=new Float64Array(size*size)
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const sx=Math.min(width-1,Math.floor((x+.5)*width/size))
  const sy=Math.min(height-1,Math.floor((y+.5)*height/size))
  const i=(sy*width+sx)*4
  const alpha=data[i+3]/255
  result[y*size+x]=(0.2126*data[i]+0.7152*data[i+1]+0.0722*data[i+2])*alpha+255*(1-alpha)
 }
 return result
}
function similarity(a,b){
 let sumA=0,sumB=0
 for(let i=0;i<a.length;i++){sumA+=a[i];sumB+=b[i]}
 const meanA=sumA/a.length,meanB=sumB/b.length
 let dot=0,aa=0,bb=0
 for(let i=0;i<a.length;i++){
  const x=a[i]-meanA,y=b[i]-meanB
  dot+=x*y;aa+=x*x;bb+=y*y
 }
 // Flat images cannot establish a meaningful match.
 if(aa<1||bb<1)return 0
 return Math.max(0,dot/Math.sqrt(aa*bb))
}
/**
 * Returns a 0..1 visual similarity score, never a verification decision.
 * Sliding square crops allow a reference to appear within a screenshot.
 * Designed for small decoded images (up to 2 megapixels), not arbitrary uploads.
 */
export function comparePromotionImages(reference,screenshot,{gridSize=16}={}){
 if(reference.width*reference.height>2_000_000||screenshot.width*screenshot.height>2_000_000)
  throw new RangeError('Resize images before comparison')
 const target=grayscaleGrid(reference,gridSize)
 grayscaleGrid(screenshot,2) // Validate input before crop sampling.
 let best=0
 // Preserve the reference aspect ratio when searching inside portrait or
 // landscape screenshots. Square crops previously distorted wide artwork.
 const aspect=reference.width/reference.height
 const referenceFit=Math.min(reference.width/screenshot.width,reference.height/screenshot.height)
 const scales=[1,.8,.65,.5,.35,.25,referenceFit]
 for(const scale of scales){
  const cropWidth=Math.min(screenshot.width,Math.max(gridSize,Math.round(scale===referenceFit?reference.width:Math.min(screenshot.width,screenshot.height*aspect)*scale)))
  const cropHeight=Math.min(screenshot.height,Math.max(gridSize,Math.round(scale===referenceFit?reference.height:cropWidth/aspect)))
  if(cropWidth<gridSize||cropHeight<gridSize)continue
  const xSteps=cropWidth===screenshot.width?1:7
  const ySteps=cropHeight===screenshot.height?1:7
  for(let yi=0;yi<ySteps;yi++)for(let xi=0;xi<xSteps;xi++){
   const left=Math.round((screenshot.width-cropWidth)*(xSteps===1?0:xi/(xSteps-1)))
   const top=Math.round((screenshot.height-cropHeight)*(ySteps===1?0:yi/(ySteps-1)))
   // Sample the crop directly; avoid allocating a new RGBA buffer for every
   // candidate. Screenshots can be large and comparisons run on mobile devices.
   const sampled=new Float64Array(gridSize*gridSize)
   for(let gy=0;gy<gridSize;gy++)for(let gx=0;gx<gridSize;gx++){
    const px=left+Math.min(cropWidth-1,Math.floor((gx+.5)*cropWidth/gridSize))
    const py=top+Math.min(cropHeight-1,Math.floor((gy+.5)*cropHeight/gridSize))
    const i=(py*screenshot.width+px)*4
    const alpha=screenshot.data[i+3]/255
    sampled[gy*gridSize+gx]=(0.2126*screenshot.data[i]+0.7152*screenshot.data[i+1]+0.0722*screenshot.data[i+2])*alpha+255*(1-alpha)
   }
   best=Math.max(best,similarity(target,sampled))
  }
 }

 return Math.round(best*1000)/1000
}
