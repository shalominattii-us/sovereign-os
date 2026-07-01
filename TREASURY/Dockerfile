FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm init -y && npm install express 2>/dev/null || true
EXPOSE 8081
CMD ["node", "-e", "const express=require('express'); const app=express(); app.use(express.json()); const ledger=require('./treasury-ledger/ledger'); const wallet=require('./wallet-runtime/wallet'); const registry=require('./asset-registry/registry'); app.get('/health',(_,r)=>r.json({ok:true,service:'AEGENTIS-TREASURY',assets:registry.list().length})); app.post('/deposit',(req,res)=>{const{walletId,asset,amount,actor}=req.body; res.json(wallet.deposit(walletId,asset,amount,actor));}); app.get('/balance/:walletId',(req,res)=>res.json(wallet.getBalance(req.params.walletId))); app.listen(process.env.PORT||8081,()=>console.log('[TREASURY] Live on port '+(process.env.PORT||8081)));"]
