import contextvars

client_ip_var = contextvars.ContextVar("client_ip", default=None)
