FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm init -y && npm install express 2>/dev/null || true
EXPOSE 8090
CMD ["node", "-e", "const express=require('express'); const identity=require('./identity'); const app=express(); app.use(express.json()); app.get('/health',(_,r)=>r.json({ok:true,service:'AEGENTIS-IDENTITY',identities:identity.identities.size})); app.post('/identity',(req,res)=>{const{type,handle}=req.body; res.json(identity.createIdentity(type,handle));}); app.get('/identity/:did',(req,res)=>{const id=identity.getIdentity(req.params.did); id?res.json(id):res.status(404).json({error:'Not found'});}); app.listen(process.env.PORT||8090,()=>console.log('[IDENTITY-OS] Live on port '+(process.env.PORT||8090)));"]
