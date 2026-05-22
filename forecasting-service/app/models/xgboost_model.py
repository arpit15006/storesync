import xgboost as xgb
import joblib
import os
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_absolute_percentage_error, r2_score

MODEL_PATH = "model_artifacts/xgboost_model.joblib"

class DemandForecaster:
    def __init__(self):
        self.model = None
        self.load_model()

    def load_model(self):
        if os.path.exists(MODEL_PATH):
            self.model = joblib.load(MODEL_PATH)
            print(f"Model loaded from {MODEL_PATH}")
        else:
            print("No pre-trained model found. Waiting for training.")

    def train(self, df):
        """
        Trains the XGBoost model on the provided synthetic DataFrame.
        Expects pre-computed features in df.
        """
        print("Starting XGBoost training...")
        
        # In a real scenario, df contains the 16 features + target.
        # Here we mock the split if the dataframe is raw. 
        # (Assuming the feature pipeline has transformed the raw df).
        
        # Temporal split (80/20)
        split_idx = int(len(df) * 0.8)
        train_df = df.iloc[:split_idx]
        test_df = df.iloc[split_idx:]
        
        X_cols = [c for c in df.columns if c.startswith('feat_')]
        y_col = 'target_quantity'
        
        X_train, y_train = train_df[X_cols], train_df[y_col]
        X_test, y_test = test_df[X_cols], test_df[y_col]
        
        # Standard XGBoost hyperparameters for tabular regression
        self.model = xgb.XGBRegressor(
            n_estimators=500,
            max_depth=6,
            learning_rate=0.05,
            subsample=0.8,
            colsample_bytree=0.8,
            early_stopping_rounds=50,
            random_state=42
        )
        
        self.model.fit(
            X_train, y_train,
            eval_set=[(X_test, y_test)],
            verbose=50
        )
        
        # Evaluation
        preds = self.model.predict(X_test)
        mae = mean_absolute_error(y_test, preds)
        mape = mean_absolute_percentage_error(y_test, preds)
        r2 = r2_score(y_test, preds)
        
        print(f"Validation MAE: {mae:.2f}")
        print(f"Validation MAPE: {mape:.2%}")
        print(f"Validation R-squared: {r2:.4f}")
        
        os.makedirs("model_artifacts", exist_ok=True)
        joblib.dump(self.model, MODEL_PATH)
        print(f"Model saved to {MODEL_PATH}")
        
        return {"mae": mae, "mape": mape, "r2": r2}

    def predict(self, feature_vector):
        if self.model is None:
            # Fallback mock prediction if model isn't trained
            return 10.0, 5.0, 15.0
            
        pred = self.model.predict(feature_vector)[0]
        # Calculate mock confidence bounds based on typical variance
        lower_bound = max(0, pred - (pred * 0.2))
        upper_bound = pred + (pred * 0.2)
        
        return float(pred), float(lower_bound), float(upper_bound)

# Singleton instance
forecaster = DemandForecaster()
