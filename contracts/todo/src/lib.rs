#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype,
    Env, String, Vec, vec,
};

#[contracttype]
#[derive(Clone)]
pub struct Todo {
    pub id: u32,
    pub text: String,
    pub completed: bool,
}

#[contracttype]
pub enum DataKey {
    Todos,
    NextId,
}

#[contract]
pub struct TodoContract;

#[contractimpl]
impl TodoContract {
    // Add a new todo
    pub fn add_todo(env: Env, text: String) -> u32 {
        let mut todos: Vec<Todo> = env
            .storage()
            .instance()
            .get(&DataKey::Todos)
            .unwrap_or(vec![&env]);

        let id: u32 = env
            .storage()
            .instance()
            .get(&DataKey::NextId)
            .unwrap_or(0);

        let todo = Todo {
            id,
            text,
            completed: false,
        };

        todos.push_back(todo);
        env.storage().instance().set(&DataKey::Todos, &todos);
        env.storage().instance().set(&DataKey::NextId, &(id + 1));
        id
    }

    // Complete a todo by id
    pub fn complete_todo(env: Env, id: u32) -> bool {
        let mut todos: Vec<Todo> = env
            .storage()
            .instance()
            .get(&DataKey::Todos)
            .unwrap_or(vec![&env]);

        let mut found = false;
        let mut new_todos: Vec<Todo> = vec![&env];

        for i in 0..todos.len() {
            let mut todo = todos.get(i).unwrap();
            if todo.id == id {
                todo.completed = true;
                found = true;
            }
            new_todos.push_back(todo);
        }

        env.storage().instance().set(&DataKey::Todos, &new_todos);
        found
    }

    // Delete a todo by id
    pub fn delete_todo(env: Env, id: u32) -> bool {
        let mut todos: Vec<Todo> = env
            .storage()
            .instance()
            .get(&DataKey::Todos)
            .unwrap_or(vec![&env]);

        let mut found = false;
        let mut new_todos: Vec<Todo> = vec![&env];

        for i in 0..todos.len() {
            let todo = todos.get(i).unwrap();
            if todo.id == id {
                found = true;
            } else {
                new_todos.push_back(todo);
            }
        }

        env.storage().instance().set(&DataKey::Todos, &new_todos);
        found
    }

    // Get all todos
    pub fn get_todos(env: Env) -> Vec<Todo> {
        env.storage()
            .instance()
            .get(&DataKey::Todos)
            .unwrap_or(vec![&env])
    }

    // Get total count
    pub fn get_count(env: Env) -> u32 {
        let todos: Vec<Todo> = env
            .storage()
            .instance()
            .get(&DataKey::Todos)
            .unwrap_or(vec![&env]);
        todos.len()
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{Env, String};

    #[test]
    fn test_add_todo() {
        let env = Env::default();
        let contract_id = env.register(TodoContract, ());
        let client = TodoContractClient::new(&env, &contract_id);
        let id = client.add_todo(&String::from_str(&env, "Buy milk"));
        assert_eq!(id, 0);
        assert_eq!(client.get_count(), 1);
    }

    #[test]
    fn test_complete_todo() {
        let env = Env::default();
        let contract_id = env.register(TodoContract, ());
        let client = TodoContractClient::new(&env, &contract_id);
        client.add_todo(&String::from_str(&env, "Buy milk"));
        let result = client.complete_todo(&0);
        assert_eq!(result, true);
        let todos = client.get_todos();
        assert_eq!(todos.get(0).unwrap().completed, true);
    }

    #[test]
    fn test_delete_todo() {
        let env = Env::default();
        let contract_id = env.register(TodoContract, ());
        let client = TodoContractClient::new(&env, &contract_id);
        client.add_todo(&String::from_str(&env, "Buy milk"));
        let result = client.delete_todo(&0);
        assert_eq!(result, true);
        assert_eq!(client.get_count(), 0);
    }

    #[test]
    fn test_get_todos_empty() {
        let env = Env::default();
        let contract_id = env.register(TodoContract, ());
        let client = TodoContractClient::new(&env, &contract_id);
        assert_eq!(client.get_count(), 0);
    }

    #[test]
    fn test_multiple_todos() {
        let env = Env::default();
        let contract_id = env.register(TodoContract, ());
        let client = TodoContractClient::new(&env, &contract_id);
        client.add_todo(&String::from_str(&env, "Task 1"));
        client.add_todo(&String::from_str(&env, "Task 2"));
        client.add_todo(&String::from_str(&env, "Task 3"));
        assert_eq!(client.get_count(), 3);
    }
}