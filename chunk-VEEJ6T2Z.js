function a(r){return r.trim().toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"")}function i(r,s,e){if(!e)return e;let t=`${s}.${a(e)}`,n=r.instant(t);return n===t?e:n}export{a,i as b};
