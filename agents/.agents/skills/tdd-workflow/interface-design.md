# Interface Design for Testability

Good interfaces make testing natural:

1. **Accept dependencies, don't create them**

   ```python
   # Testable
   def process_order(order, payment_gateway):
       ...
       
   # Hard to test
   def process_order(order):
       gateway = new StripeGateway();
       ...
   ```

2. **Return results, don't produce side effects**

   ```python
   # Testable
   def calculate_discount(cart):
       ...
       
   # Hard to test
   def apply_discount(cart):
       cart.total -= discount
   ```

3. **Small surface area**
   - Fewer methods = fewer tests needed
   - Fewer params = simpler test setup
