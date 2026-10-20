# Same-origin React + Node API + Python/RDKit. No persistent guest storage.
FROM node:24-bookworm-slim AS node-runtime
FROM python:3.12-slim-bookworm
COPY --from=node-runtime /usr/local/bin/node /usr/local/bin/node
COPY --from=node-runtime /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
 && apt-get update && apt-get install -y --no-install-recommends libgomp1 libstdc++6 libatomic1 libxrender1 libxext6 \
 && rm -rf /var/lib/apt/lists/* \
 && useradd --create-home --uid 10001 app
WORKDIR /app
COPY package.json package-lock.json requirements.txt ./
RUN npm ci --no-audit --no-fund && python -m pip install --no-cache-dir -r requirements.txt
RUN python -c "from rdkit.Chem import Draw, AllChem; import numpy; print('RDKit drawing/3D backend imports OK')"
COPY . .
RUN PUBLIC_DIST_DIR=dist npm run build:public
ENV NODE_ENV=production S5_PUBLIC_MODE=1 PUBLIC_DIST_DIR=dist PUBLIC_MAX_CONCURRENCY=1 \
    PYTHON_EXECUTABLE=python PYTHONUTF8=1 PYTHONDONTWRITEBYTECODE=1 \
    OMP_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1 MKL_NUM_THREADS=1 PORT=10000
USER app
EXPOSE 10000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node","--import","tsx","public-server.ts"]
