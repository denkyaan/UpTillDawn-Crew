type TargetRect={top:number;height:number}

export function tourPanelLayout(target:TargetRect|null,viewportHeight:number,mobile:boolean){
  const top=72
  const bottom=mobile?84:16
  if(!target)return {top:'auto',bottom,maxHeight:Math.max(80,viewportHeight-top-bottom)}
  const above=Math.max(0,target.top-top-12)
  const below=Math.max(0,viewportHeight-bottom-target.top-target.height-12)
  return above>below
    ?{top,bottom:'auto',maxHeight:above}
    :{top:'auto',bottom,maxHeight:below}
}
