function r(l){if(l.length===0)return null;let n=l.reduce((e,t)=>({lat:e.lat+t.lat,lng:e.lng+t.lng}),{lat:0,lng:0});return{lat:n.lat/l.length,lng:n.lng/l.length}}export{r as a};
