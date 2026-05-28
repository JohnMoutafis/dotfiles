# When to Mock

Mock at **system boundaries** only:

- External APIs (payment, email, etc.)
- Databases (sometimes - prefer test DB)
- Time/randomness
- File system (sometimes)

Don't mock:

- Your own classes/modules
- Internal collaborators
- Anything you control

## Designing for Mockability

At system boundaries, design interfaces that are easy to mock:

**1. Use dependency injection**

Pass external dependencies in rather than creating them internally:

```python
# Easy to mock
def process_payment(order, payment_client):
  return payment_client.charge(order.total)

# Hard to mock
def process_payment(order):
  client = StripeClient(process.env.STRIPE_KEY)
  return client.charge(order.total)
```

**2. Prefer SDK-style interfaces over generic fetchers**

Create specific functions for each external operation instead of one generic function with conditional logic:

```python
# GOOD: Each function is independently mockable
def fetch_user(id) -> UserModel:
    user = UserModel.objects.get(id=id)
    return user

def fetch_user_orders(user_id) -> List[OrderModel]:
    orders = OrderModel.objects.filter(user_id=user_id)
    return orders

def create_order(data) -> OrderModel:
    return OrderModel.objects.create(**data)

# BAD: Mocking requires conditional logic inside the mock
def user_actions(action, user_id, **kwargs) -> Union[UserModel, OrderModel]:
    if action == 'fetch':
        user = UserModel.objects.get(id=user_id)
        return user
    elif action == 'fetch_orders':
        orders = OrderModel.objects.filter(user_id=user_id)
        return orders
    elif action == 'create_order':
        kwargs['user_id'] = user_id
        return OrderModel.objects.create(**kwargs)
    else:
        raise ValueError(f'Unknown action: {action}')
```

The SDK approach means:
- Each mock returns one specific shape
- No conditional logic in test setup
- Easier to see which endpoints a test exercises
- Type safety per endpoint
