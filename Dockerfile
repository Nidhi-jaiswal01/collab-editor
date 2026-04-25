FROM node:18 AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt ./
RUN pip install -r requirements.txt
COPY --from=frontend-build /app/frontend/dist ./frontend/dist
COPY app.py room_manager.py ot_engine.py ./
EXPOSE 7860
CMD ["python", "app.py"]