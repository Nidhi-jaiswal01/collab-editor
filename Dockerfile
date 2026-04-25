FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt ./
RUN pip install -r requirements.txt
COPY app.py room_manager.py ot_engine.py ./
COPY dist/ ./dist/
EXPOSE 7860
CMD ["python", "app.py"]