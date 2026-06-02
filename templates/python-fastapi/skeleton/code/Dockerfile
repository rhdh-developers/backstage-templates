FROM registry.access.redhat.com/ubi10/ubi-minimal:latest

WORKDIR /app

RUN microdnf install -y --disablerepo='*' --enablerepo='ubi-10-*' python3 python3-pip && \
    microdnf clean all

COPY requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
