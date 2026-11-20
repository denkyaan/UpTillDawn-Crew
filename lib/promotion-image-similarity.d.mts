export type RgbaImage={width:number;height:number;data:Uint8Array|Uint8ClampedArray}
export function grayscaleGrid(image:RgbaImage,size?:number):Float64Array
export function comparePromotionImages(reference:RgbaImage,screenshot:RgbaImage,options?:{gridSize?:number}):number
